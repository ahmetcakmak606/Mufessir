#!/usr/bin/env python3
"""
kite_c3_reliability.py
======================
Inter-rater reliability for the KITE C3 gold-set attribution coding
(Cüneyt Sapanca, "The Kulliyyah Test").

Computes, on the in_prompt (N vs not-N codeable) rows ONLY:
    - 2x2 confusion matrix + marginals
    - N-prevalence (per coder and pooled)              -> prevalence-paradox diagnosis
    - Raw observed agreement (p0)
    - Cohen's kappa (Cohen 1960; cf. 1968 weighted variant not used here, unweighted binary)
    - PABAK  (Byrt, Bishop & Carlin 1993) = 2*p0 - 1   -> prevalence/bias-adjusted
    - Run-clustered nonparametric bootstrap 95% CI for kappa
      (resampling unit = run, NOT row; the 59/58 rows are nested in 12 runs and
       are NOT independent -> a naive per-row CI is anticonservative)

Rows with class S (prompt-excluded metadata) and class F (fabrication flag) are
EXCLUDED from the kappa base by construction; neither enters the denominator.
S is machine-computable; F is a single human-confirmed case (run_019 / Ibn al-Qayyim).

The machine N-suggestion is NOT read here and MUST NOT be in the sheet
(blind coding / anti-anchoring). This script only ingests the two HUMAN columns.

Usage
-----
    python3 kite_c3_reliability.py gold-coding-sheet.jsonl
    python3 kite_c3_reliability.py gold-coding-sheet.jsonl --bootstrap 10000 --seed 42
    python3 kite_c3_reliability.py gold-coding-sheet.jsonl --expect-inprompt 58
    python3 kite_c3_reliability.py --selftest

Design notes
------------
* The script REFUSES to compute kappa if any in_prompt row is left uncoded by
  either coder (null / blank), and lists the offending (runId, scholarId).
  Silently dropping uncoded rows would shrink the base and bias the estimate.
* Partition sanity check: counts S / in_prompt / F and cross-checks the total (82)
  and the in_prompt count against --expect-inprompt (default 58, the value implied
  by the retrieval trace: sum of prompt_included|unique over the 12 gold cells).
  A mismatch is a HARD STOP: it means a scholar sits on the wrong side of the
  S / in_prompt boundary and the kappa base is wrong.
"""

from __future__ import annotations
import argparse
import json
import sys
from collections import Counter, defaultdict

import numpy as np

# --------------------------------------------------------------------------- #
# CONFIG  -- adjust field names here if Code's sheet uses different keys.      #
# The script prints the resolved mapping so you can verify against the sheet. #
# --------------------------------------------------------------------------- #
RUN_FIELDS      = ["runId", "run_id", "run"]
SCHOLAR_FIELDS  = ["scholarId", "scholar_id", "id"]
SCHOLAR_EN      = ["scholarEn", "scholarName", "scholar_en", "en"]
CODER1_FIELDS   = ["N_human1", "n_human1", "coder1", "N1", "human1"]
CODER2_FIELDS   = ["N_human2", "n_human2", "coder2", "N2", "human2"]
CLASS_FIELDS    = ["row_class", "class", "category", "code_class"]
# boolean-style flags, used only if no single CLASS field is present
FLAG_S          = ["S", "is_S", "prompt_excluded"]
FLAG_INPROMPT   = ["in_prompt", "inPrompt", "is_in_prompt"]
FLAG_F          = ["F_candidate", "F", "is_F", "fabrication"]
FLAG_U          = ["U", "is_U", "ungrounded"]   # named ∧ retrieved ∧ ¬prompt

# token normalisation for the two human columns
N_TOKENS    = {"n", "named", "1", "true", "yes", "y"}
NOTN_TOKENS = {"not-n", "notn", "not_n", "0", "false", "no", "u", "unnamed", "nn"}
NA_TOKENS   = {"n/a", "na", "n.a.", "-", "f"}          # F row markers (excluded)
NULL_TOKENS = {None, "", "null", "none"}               # uncoded (HARD STOP if in_prompt)

EXPECT_TOTAL     = 82
DEFAULT_EXPECT_INPROMPT = 58   # sum of prompt_included|unique over the 12 gold cells
DEFAULT_B        = 10000
DEFAULT_SEED     = 42
KAPPA_THRESHOLD  = 0.75        # adjudicator branch trigger


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
def resolve_field(row: dict, candidates: list[str]):
    for c in candidates:
        if c in row:
            return c
    return None


def norm_token(v):
    """Return 'N', 'notN', 'NA', or 'NULL' for a raw human-column value."""
    if v in NULL_TOKENS:
        return "NULL"
    s = str(v).strip().lower()
    if s in NULL_TOKENS:
        return "NULL"
    if s in N_TOKENS:
        return "N"
    if s in NOTN_TOKENS:
        return "notN"
    if s in NA_TOKENS:
        return "NA"
    return "UNKNOWN:" + str(v)


def classify(row: dict, f_class, f_S, f_inp, f_F, f_U, f_c1, f_c2) -> str:
    """Return 'S' | 'in_prompt' | 'F' | 'U' | 'UNKNOWN' for a sheet row."""
    if f_class:
        raw = str(row.get(f_class, "")).strip().lower()
        if raw in {"s", "prompt_excluded", "excluded"}:
            return "S"
        if raw in {"in_prompt", "inprompt", "prompt", "codeable"}:
            return "in_prompt"
        if raw in {"f", "f_candidate", "fabrication"}:
            return "F"
        if raw in {"u", "ungrounded"}:
            return "U"
    # fall back to boolean flags
    if f_F and str(row.get(f_F)).strip().lower() in {"1", "true", "yes"}:
        return "F"
    if f_U and str(row.get(f_U)).strip().lower() in {"1", "true", "yes"}:
        return "U"
    if f_S and str(row.get(f_S)).strip().lower() in {"1", "true", "yes"}:
        return "S"
    if f_inp and str(row.get(f_inp)).strip().lower() in {"1", "true", "yes"}:
        return "in_prompt"
    # last resort: infer from the human columns
    t1 = norm_token(row.get(f_c1)) if f_c1 else "NULL"
    t2 = norm_token(row.get(f_c2)) if f_c2 else "NULL"
    if "NA" in (t1, t2):
        return "F"
    if t1 in {"N", "notN"} or t2 in {"N", "notN"}:
        return "in_prompt"
    return "UNKNOWN"


def kappa_from_pairs(pairs):
    """
    pairs: list of (bool, bool) where True = coder judged 'N'.
    Returns dict(p0, pe, kappa, pabak, a, b, c, d, n).
    kappa is None when undefined (pe == 1, degenerate single-category table).
    """
    a = b = c = d = 0
    for x, y in pairs:
        if x and y:
            a += 1
        elif x and not y:
            b += 1
        elif (not x) and y:
            c += 1
        else:
            d += 1
    n = a + b + c + d
    if n == 0:
        return dict(p0=None, pe=None, kappa=None, pabak=None, a=a, b=b, c=c, d=d, n=0)
    p0 = (a + d) / n
    pN1 = (a + b) / n
    pN2 = (a + c) / n
    pe = pN1 * pN2 + (1 - pN1) * (1 - pN2)
    kappa = None if abs(1 - pe) < 1e-12 else (p0 - pe) / (1 - pe)
    pabak = 2 * p0 - 1
    return dict(p0=p0, pe=pe, kappa=kappa, pabak=pabak, a=a, b=b, c=c, d=d, n=n)


def clustered_bootstrap(pairs_by_run, B, seed):
    """Resample runs (clusters) with replacement; recompute kappa each draw."""
    rng = np.random.default_rng(seed)
    runs = list(pairs_by_run.keys())
    k = len(runs)
    kappas = []
    n_degenerate = 0
    for _ in range(B):
        idx = rng.integers(0, k, size=k)
        pooled = []
        for j in idx:
            pooled.extend(pairs_by_run[runs[j]])
        res = kappa_from_pairs(pooled)
        if res["kappa"] is None:
            n_degenerate += 1
        else:
            kappas.append(res["kappa"])
    kappas = np.array(kappas)
    return kappas, n_degenerate


# --------------------------------------------------------------------------- #
# main analysis                                                               #
# --------------------------------------------------------------------------- #
def load_rows(path):
    """Format-agnostic: accepts a single JSON array, a single object,
    compact JSONL, or a pretty-printed / concatenated stream of objects."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read().strip()
    if not text:
        return []
    # 1) single top-level value (array or object)?
    try:
        obj = json.loads(text)
        if isinstance(obj, list):
            return obj
        if isinstance(obj, dict):
            return [obj]
    except json.JSONDecodeError:
        pass
    # 2) concatenated / newline-delimited values (JSONL or pretty stream)
    rows, dec, idx, n = [], json.JSONDecoder(), 0, len(text)
    while idx < n:
        while idx < n and text[idx] in " \t\r\n":
            idx += 1
        if idx >= n:
            break
        try:
            val, end = dec.raw_decode(text, idx)
        except json.JSONDecodeError as e:
            snippet = text[idx:idx + 80].replace("\n", "\\n")
            sys.exit(f"[FATAL] JSON parse failed near offset {idx}: {e}\n  ...{snippet}...")
        rows.append(val)
        idx = end
    return rows


def analyse(path, B, seed, expect_inprompt):
    rows = load_rows(path)
    if not rows:
        sys.exit("[FATAL] empty sheet.")

    sample = rows[0]
    f_run   = resolve_field(sample, RUN_FIELDS)
    f_sch   = resolve_field(sample, SCHOLAR_FIELDS)
    f_en    = resolve_field(sample, SCHOLAR_EN)
    f_c1    = resolve_field(sample, CODER1_FIELDS)
    f_c2    = resolve_field(sample, CODER2_FIELDS)
    f_class = resolve_field(sample, CLASS_FIELDS)
    f_S     = resolve_field(sample, FLAG_S)
    f_inp   = resolve_field(sample, FLAG_INPROMPT)
    f_F     = resolve_field(sample, FLAG_F)
    f_U     = resolve_field(sample, FLAG_U)

    print("=" * 70)
    print("SCHEMA RESOLUTION (verify these against your sheet)")
    print("=" * 70)
    for label, fld in [("run", f_run), ("scholarId", f_sch), ("scholarEn", f_en),
                       ("coder1", f_c1), ("coder2", f_c2), ("class", f_class),
                       ("flag_S", f_S), ("flag_in_prompt", f_inp),
                       ("flag_F", f_F), ("flag_U", f_U)]:
        print(f"  {label:16s} -> {fld}")
    if not (f_run and f_sch and f_c1 and f_c2):
        sys.exit("[FATAL] could not resolve run/scholar/coder fields. "
                 "Edit the *_FIELDS constants at the top of the script.")

    # classify every row
    classes = Counter()
    inprompt_rows, f_rows, s_rows, u_rows, unknown_rows = [], [], [], [], []
    for r in rows:
        cls = classify(r, f_class, f_S, f_inp, f_F, f_U, f_c1, f_c2)
        classes[cls] += 1
        if cls == "in_prompt":
            inprompt_rows.append(r)
        elif cls == "F":
            f_rows.append(r)
        elif cls == "U":
            u_rows.append(r)
        elif cls == "S":
            s_rows.append(r)
        else:
            unknown_rows.append(r)

    print("\n" + "=" * 70)
    print("PARTITION SANITY CHECK")
    print("=" * 70)
    print(f"  total rows      : {len(rows)}")
    print(f"  in_prompt       : {classes['in_prompt']}   (kappa base)")
    print(f"  S (excluded)    : {classes['S']}")
    print(f"  U (excluded)    : {classes['U']}   (ungrounded: named ∧ retrieved ∧ ¬prompt)")
    print(f"  F (excluded)    : {classes['F']}")
    print(f"  UNKNOWN         : {classes['UNKNOWN']}")

    hard_stop = False
    if len(rows) != EXPECT_TOTAL:
        print(f"  [WARN] total {len(rows)} != expected {EXPECT_TOTAL}")
        hard_stop = True
    if classes["UNKNOWN"]:
        print(f"  [WARN] {classes['UNKNOWN']} rows could not be classified "
              f"(check class/flag fields).")
        hard_stop = True
    if classes["in_prompt"] != expect_inprompt:
        print(f"  [HARD STOP] in_prompt = {classes['in_prompt']} but the retrieval "
              f"trace implies {expect_inprompt}.")
        print(f"              One scholar is on the wrong side of the S/in_prompt "
              f"boundary. Reconcile the sheet before coding.")
        print(f"              (override with --expect-inprompt N once you have "
              f"confirmed the correct base.)")
        hard_stop = True

    # check every in_prompt row is fully coded
    uncoded, unknown_vals = [], []
    pairs = []
    pairs_by_run = defaultdict(list)
    prev1 = prev2 = 0
    for r in inprompt_rows:
        t1 = norm_token(r.get(f_c1))
        t2 = norm_token(r.get(f_c2))
        rid = r.get(f_run)
        sid = r.get(f_sch)
        if t1 == "NULL" or t2 == "NULL":
            uncoded.append((rid, sid, t1, t2))
            continue
        if t1.startswith("UNKNOWN") or t2.startswith("UNKNOWN"):
            unknown_vals.append((rid, sid, r.get(f_c1), r.get(f_c2)))
            continue
        x = (t1 == "N")
        y = (t2 == "N")
        prev1 += x
        prev2 += y
        pairs.append((x, y))
        pairs_by_run[rid].append((x, y))

    if uncoded:
        print("\n  [HARD STOP] uncoded in_prompt rows (both coders must code every row):")
        for rid, sid, t1, t2 in uncoded:
            print(f"     run={rid}  scholarId={sid}  coder1={t1}  coder2={t2}")
        hard_stop = True
    if unknown_vals:
        print("\n  [HARD STOP] unrecognised code values (expected N / not-N):")
        for rid, sid, v1, v2 in unknown_vals:
            print(f"     run={rid}  scholarId={sid}  coder1={v1!r}  coder2={v2!r}")
        hard_stop = True

    if hard_stop:
        sys.exit("\n[ABORT] Resolve the issues above; kappa NOT computed "
                 "(refusing to report a reliability figure on a malformed base).")

    # ----------------------------------------------------------------- metrics
    n = len(pairs)
    res = kappa_from_pairs(pairs)

    print("\n" + "=" * 70)
    print("CONFUSION MATRIX  (rows = coder1, cols = coder2)")
    print("=" * 70)
    print(f"                 coder2=N   coder2=not-N   |  total")
    print(f"  coder1=N        {res['a']:6d}     {res['b']:6d}      | {res['a']+res['b']:6d}")
    print(f"  coder1=not-N    {res['c']:6d}     {res['d']:6d}      | {res['c']+res['d']:6d}")
    print(f"  total           {res['a']+res['c']:6d}     {res['b']+res['d']:6d}      | {n:6d}")

    print("\n" + "=" * 70)
    print("PREVALENCE  (diagnoses prevalence paradox)")
    print("=" * 70)
    print(f"  coder1 N-rate : {prev1}/{n} = {prev1/n:.3f}")
    print(f"  coder2 N-rate : {prev2}/{n} = {prev2/n:.3f}")
    pooled_N = res['a'] + res['b'] + res['a'] + res['c']  # counts, both coders
    print(f"  pooled N-rate : {(prev1+prev2)}/{2*n} = {(prev1+prev2)/(2*n):.3f}")
    pi = ((res['a']+res['b']) - (res['a']+res['c'])) / n
    print(f"  prevalence index |P(N)-P(notN)| (coder1) : {abs((res['a']+res['b'])-(res['c']+res['d']))/n:.3f}")
    print(f"  bias index |P1(N)-P2(N)|                  : {abs(prev1-prev2)/n:.3f}")

    print("\n" + "=" * 70)
    print("AGREEMENT INDICES")
    print("=" * 70)
    print(f"  raw agreement p0        : {res['p0']:.4f}")
    print(f"  expected agreement pe   : {res['pe']:.4f}")
    if res['kappa'] is None:
        print(f"  Cohen's kappa           : UNDEFINED (degenerate single-category table)")
    else:
        print(f"  Cohen's kappa           : {res['kappa']:.4f}")
    print(f"  PABAK (2*p0 - 1)        : {res['pabak']:.4f}")

    # cross-validate kappa against sklearn if present
    try:
        from sklearn.metrics import cohen_kappa_score
        y1 = [int(x) for x, _ in pairs]
        y2 = [int(y) for _, y in pairs]
        kk = cohen_kappa_score(y1, y2)
        tag = "OK" if (res['kappa'] is None or abs(kk - res['kappa']) < 1e-9) else "MISMATCH!"
        print(f"  [xcheck] sklearn kappa  : {kk:.4f}  [{tag}]")
    except Exception:
        pass

    # ----------------------------------------------------------- bootstrap CI
    print("\n" + "=" * 70)
    print(f"RUN-CLUSTERED BOOTSTRAP 95% CI  (B={B}, seed={seed}, "
          f"{len(pairs_by_run)} clusters)")
    print("=" * 70)
    kappas, n_degen = clustered_bootstrap(pairs_by_run, B, seed)
    if len(kappas) == 0:
        print("  [WARN] every resample degenerate; CI undefined. "
              "Prevalence is extreme -> report PABAK + raw instead of kappa.")
    else:
        lo, hi = np.percentile(kappas, [2.5, 97.5])
        print(f"  point estimate          : {res['kappa']:.4f}")
        print(f"  bootstrap mean          : {kappas.mean():.4f}")
        print(f"  95% CI (percentile)     : [{lo:.4f}, {hi:.4f}]")
        print(f"  resamples used          : {len(kappas)}/{B}")
        print(f"  degenerate resamples    : {n_degen}/{B}  "
              f"({100*n_degen/B:.1f}%)")
        if n_degen / B > 0.05:
            print("  [NOTE] >5% of resamples degenerate: kappa is unstable at this "
                  "prevalence; foreground PABAK + raw agreement in the paper.")

    # ------------------------------------------------------ adjudicator branch
    print("\n" + "=" * 70)
    print("ADJUDICATOR BRANCH")
    print("=" * 70)
    disagreements = [(r.get(f_run), r.get(f_sch), r.get(f_en))
                     for r in inprompt_rows
                     if norm_token(r.get(f_c1)) != norm_token(r.get(f_c2))
                     and norm_token(r.get(f_c1)) in {"N", "notN"}
                     and norm_token(r.get(f_c2)) in {"N", "notN"}]
    kap = res['kappa']
    if kap is not None and kap < KAPPA_THRESHOLD:
        print(f"  kappa {kap:.4f} < {KAPPA_THRESHOLD} -> adjudicator (3rd coder) "
              f"resolves the {len(disagreements)} disagreement rows:")
    else:
        print(f"  kappa >= {KAPPA_THRESHOLD}; adjudication optional. "
              f"Disagreement rows ({len(disagreements)}) for the record:")
    for rid, sid, en in disagreements:
        print(f"     run={rid}  scholarId={sid}  {en or ''}")

    # -------------------------------------------------------- machine summary
    summary = dict(
        n_inprompt=n, n_S=classes["S"], n_F=classes["F"], n_total=len(rows),
        p0=res['p0'], pe=res['pe'], kappa=res['kappa'], pabak=res['pabak'],
        prevalence_c1=prev1 / n, prevalence_c2=prev2 / n,
        confusion=dict(a=res['a'], b=res['b'], c=res['c'], d=res['d']),
        bootstrap=dict(B=B, seed=seed, clusters=len(pairs_by_run),
                       ci_low=float(np.percentile(kappas, 2.5)) if len(kappas) else None,
                       ci_high=float(np.percentile(kappas, 97.5)) if len(kappas) else None,
                       degenerate=n_degen),
        n_disagreements=len(disagreements),
    )
    with open("kite_c3_reliability_summary.json", "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print("\n[written] kite_c3_reliability_summary.json")


# --------------------------------------------------------------------------- #
# self-test                                                                   #
# --------------------------------------------------------------------------- #
def selftest():
    """Synthetic sheet: 58 in_prompt over 12 runs, 23 S, 1 F.
    Confusion a=50,b=3,c=3,d=2 -> raw .897, kappa .344, PABAK .793 (paradox)."""
    import tempfile, os
    rng = np.random.default_rng(0)
    sizes = [5,5,5,4,5,5,5,5,5,5,4,5]  # sums to 58
    runs = [f"run_{i:03d}" for i in range(len(sizes))]
    rows = []
    # build the target confusion matrix labels then scatter into runs
    labels = ([("N","N")]*50 + [("N","notN")]*3 + [("notN","N")]*3 + [("notN","notN")]*2)
    rng.shuffle(labels)
    li = 0
    for run, sz in zip(runs, sizes):
        for j in range(sz):
            c1, c2 = labels[li]; li += 1
            rows.append(dict(runId=run, scholarId=100+li, scholarEn=f"sch{li}",
                             row_class="in_prompt", N_human1=c1, N_human2=c2))
    for i in range(23):
        rows.append(dict(runId="run_000", scholarId=200+i, scholarEn=f"S{i}",
                         row_class="S", N_human1=None, N_human2=None))
    rows.append(dict(runId="run_003", scholarId=63, scholarEn="Ibn al-Qayyim",
                     row_class="F", N_human1="N/A", N_human2="N/A"))
    fd, p = tempfile.mkstemp(suffix=".jsonl"); os.close(fd)
    with open(p, "w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[selftest] wrote {len(rows)} rows to {p}\n")
    analyse(p, B=2000, seed=1, expect_inprompt=58)
    os.remove(p)


# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet", nargs="?", help="gold-coding-sheet.jsonl")
    ap.add_argument("--bootstrap", type=int, default=DEFAULT_B)
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--expect-inprompt", type=int, default=DEFAULT_EXPECT_INPROMPT)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        selftest()
    elif args.sheet:
        analyse(args.sheet, args.bootstrap, args.seed, args.expect_inprompt)
    else:
        ap.print_help()
        sys.exit(1)
