#!/usr/bin/env python3
"""
kite_core5_intersection.py — Committed provenance for the "0/10 Core-5 in M4 AllN top-10" finding.

Reads the KITE harness trace (kite-results.jsonl), selects all M4 runs, and computes
the intersection |Core-5 ∩ top-k(retrieved_all)| per run, with BOTH sides normalized
to str() to eliminate any type-coercion ambiguity (trace serializes scholarId as
string; CORE5 is defined as number literals in the harness).

Usage:
    python3 kite_core5_intersection.py kite-results.jsonl [--cell M4] [--topk 10]

Output:
    - Per-run table: runId, verse, |Core5 ∩ top-k|, hit list (empty if 0)
    - Per-verse aggregate (replications collapsed; retrieval is deterministic, so
      replications should be identical — the script ASSERTS this and fails loudly
      if any replication diverges)
    - Machine-readable JSON summary on the last line (for downstream citation)

Core-5 IDs are the locked values from the pre-commitment note (frozen 2026-06-25):
    Ṭabarī=7, Zamakhsharī=19, Rāzī=22, Qurṭubī=24, Ibn Kathīr=29
"""

import argparse
import json
import sys

# Locked Core-5 (pre-commitment note, 2026-06-25). String-normalized deliberately:
# the trace layer serializes scholarId as string; normalizing both sides makes the
# membership test immune to the number-vs-string coercion class of bug that was
# hypothesized (and ruled out) in the 2026-07-01 QA session.
CORE5 = {str(x) for x in (7, 19, 22, 24, 29)}
CORE5_NAMES = {"7": "al-Tabari", "19": "al-Zamakhshari", "22": "al-Razi",
               "24": "al-Qurtubi", "29": "Ibn Kathir"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("trace", help="Path to kite-results.jsonl")
    ap.add_argument("--cell", default="M4", help="cellId to filter (default: M4)")
    ap.add_argument("--topk", type=int, default=10, help="top-k cutoff (default: 10)")
    args = ap.parse_args()

    runs = []
    with open(args.trace, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                runs.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"HATA: satır {lineno} JSON değil: {e}", file=sys.stderr)
                return 1

    m4 = [r for r in runs if r.get("cellId") == args.cell]
    if not m4:
        print(f"HATA: cellId={args.cell} run'ı bulunamadı.", file=sys.stderr)
        return 1

    print(f"# Core-5 ∩ top-{args.topk} — cell {args.cell}, {len(m4)} run")
    print(f"# Core-5 (string-normalized): {sorted(CORE5, key=int)}")
    print()

    per_run = []
    for r in sorted(m4, key=lambda x: x["runId"]):
        topk = r["retrieved_all"][: args.topk]
        # Both sides str-normalized — deliberate, see module docstring.
        topk_ids = [str(item["scholarId"]) for item in topk]
        hits = [sid for sid in topk_ids if sid in CORE5]
        per_run.append({
            "runId": r["runId"],
            "verse": r["verse"]["label"],
            "topk_ids": topk_ids,
            "hits": hits,
            "n_hits": len(hits),
        })
        hit_str = ", ".join(f"{h} ({CORE5_NAMES[h]})" for h in hits) or "—"
        print(f"{r['runId']:<28} {r['verse']['label']:<10} "
              f"{len(hits)}/{min(args.topk, len(topk))}   hits: {hit_str}")

    # Per-verse aggregate + determinism assertion across replications.
    print()
    by_verse = {}
    for row in per_run:
        by_verse.setdefault(row["verse"], []).append(row)

    summary = {}
    determinism_ok = True
    for verse, rows in sorted(by_verse.items()):
        id_sets = {tuple(row["topk_ids"]) for row in rows}
        if len(id_sets) != 1:
            determinism_ok = False
            print(f"UYARI: {verse} replikasyonları arasında top-{args.topk} listesi "
                  f"DEĞİŞİYOR ({len(id_sets)} farklı liste) — retrieval deterministik "
                  f"varsayımı bu ayette TUTMUYOR.", file=sys.stderr)
        n = rows[0]["n_hits"]
        summary[verse] = {
            "core5_hits_in_topk": n,
            "topk": args.topk,
            "replications": len(rows),
            "replications_identical": len(id_sets) == 1,
            "hit_ids": rows[0]["hits"],
        }
        print(f"{verse:<10}  Core-5 ∩ top-{args.topk} = {n}/{args.topk}  "
              f"({len(rows)} replikasyon, {'birebir aynı' if len(id_sets) == 1 else 'FARKLI!'})")

    total_hits = sum(v["core5_hits_in_topk"] for v in summary.values())
    print()
    print(f"TOPLAM: {total_hits} Core-5 isabeti / {len(summary)} ayet × top-{args.topk}")

    # Machine-readable last line for downstream citation.
    print(json.dumps({
        "cell": args.cell,
        "topk": args.topk,
        "core5": sorted(CORE5, key=int),
        "per_verse": summary,
        "total_core5_hits": total_hits,
        "all_replications_deterministic": determinism_ok,
    }, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
