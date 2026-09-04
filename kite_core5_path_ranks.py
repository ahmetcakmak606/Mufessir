#!/usr/bin/env python3
"""
kite_core5_path_ranks.py — Brief A: Core-5 slot/rank dagilimi, temsil-yoluna gore (§4.1)

READ-ONLY. Girdi yalnizca commit'li artefaktlar: kite-results.jsonl (63 run),
kite-probe31-v2.jsonl (4 ayet x 3 rep, k=95 tam havuz). OpenAI YOK, DB YOK.

Soru: Core-5 dislanmasi temsil-yolundan (parent-embedding vs chunk-embedding)
bagimsiz mi; ve chunk-yolu sistematik daha iyi rank veriyor mu?

Temsil-yolu etiketleri RESULTS-2026-09-02.md §1'den (kite-core5-occupancy.ts).
Cikti: kite_core5_path_ranks.out.txt
"""
import json, statistics as st
from collections import defaultdict

CORE5 = {"7":"al-Tabari","19":"al-Zamakhshari","22":"al-Razi","24":"al-Qurtubi","29":"Ibn Kathir"}

# 25 doluluk hucresi (5 verse_id x 5 mufessir): P = parent-only, C = chunk-only
PATH_VID = {
    ("20-5","7"):"P", ("20-5","19"):"P", ("20-5","22"):"P", ("20-5","24"):"P", ("20-5","29"):"P",
    ("24-35","7"):"C",("24-35","19"):"P",("24-35","22"):"C",("24-35","24"):"C",("24-35","29"):"P",
    ("27-18","7"):"P",("27-18","19"):"P",("27-18","22"):"P",("27-18","24"):"P",("27-18","29"):"P",
    ("27-19","7"):"P",("27-19","19"):"P",("27-19","22"):"P",("27-19","24"):"P",("27-19","29"):"P",
    ("3-7","7"):"C",  ("3-7","19"):"P",  ("3-7","22"):"C",  ("3-7","24"):"C",  ("3-7","29"):"C",
}
VERSE_IDS = {"20:5":["20-5"], "24:35":["24-35"], "3:7":["3-7"], "27:18-19":["27-18","27-19"]}

# Havuzun GERCEK buyuklugu (vektorlu tekil mufessir), DB'den olculdu:
# kite-naml-kulli-gap.ts (2026-09-03). 27:18-19'da probe k=95 SATIR limiti,
# isRange satir-cogaltmasi yuzunden yalniz 58 tekil mufessire ulasir; havuzun
# kendisi 72'dir. Yuzdelikler bu gercek paydaya gore hesaplanir. RANK degerleri
# etkilenmez: dilim, skora gore tepeden alinmis bir prefikstir.
TRUE_POOL = {"20:5": 63, "24:35": 79, "3:7": 75, "27:18-19": 72}

def path(vlabel, sid):
    s = {PATH_VID[(v, sid)] for v in VERSE_IDS[vlabel]}
    return s.pop() if len(s) == 1 else "MIXED"

def spearman(xs, ys):
    def rk(v):
        order = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0]*len(v); i = 0
        while i < len(order):
            j = i
            while j+1 < len(order) and v[order[j+1]] == v[order[i]]: j += 1
            avg = (i+j)/2 + 1
            for k in range(i, j+1): r[order[k]] = avg
            i = j+1
        return r
    a, b = rk(xs), rk(ys); n = len(xs)
    ma, mb = sum(a)/n, sum(b)/n
    num = sum((x-ma)*(y-mb) for x, y in zip(a, b))
    den = (sum((x-ma)**2 for x in a) * sum((y-mb)**2 for y in b)) ** 0.5
    return num/den if den else float("nan")

runs  = [json.loads(l) for l in open("kite-results.jsonl") if l.strip()]
probe = [json.loads(l) for l in open("kite-probe31-v2.jsonl") if l.strip()]
N2I = {}
for r in runs + probe:
    for e in r["retrieved_all"]: N2I[e["scholarName"].strip().lower()] = str(e["scholarId"])
def to_ids(names): return {N2I[n.strip().lower()] for n in names if n.strip().lower() in N2I}

L = []
def out(s=""): print(s); L.append(s)

out("="*80); out("BRIEF A — Core-5 slot/rank dagilimi, temsil-yoluna gore"); out("="*80)

# ---- 0. temsil-yolu envanteri
out("\n[0] TEMSIL-YOLU ENVANTERI (kaynak: RESULTS-2026-09-02.md §1)")
c = defaultdict(int)
for v in PATH_VID.values(): c[v] += 1
out(f"    doluluk hucresi (5 verse_id x 5 mufessir) = {sum(c.values())}"
    f"  |  parent-only = {c['P']}  chunk-only = {c['C']}")
for v in ["20-5","24-35","27-18","27-19","3-7"]:
    out("    " + f"{v:8s} " + "  ".join(f"{CORE5[s]}={PATH_VID[(v,s)]}" for s in ["7","19","22","24","29"]))
out(f"    rank izgarasi (4 sorgu-ayeti x 5 mufessir) = 20 hucre  |  parent = 13  chunk = 7")
out("    NOT: 27:18-19 tek sorgu, iki verse_id (10 doluluk hucresi -> 5 rank hucresi); hepsi parent.")

# ---- 1. tam-havuz rank
out("\n[1] TAM-HAVUZ RANK (probe31-v2 k=95, kanonik rep=r1)")
rows = []
by_verse = defaultdict(list)
for r in probe: by_verse[r["verse"]["label"]].append(r)
for vlabel in ["3:7","20:5","24:35","27:18-19"]:
    for rep in sorted(by_verse[vlabel], key=lambda r: r["replication"]):
        ra = rep["retrieved_all"]
        order = sorted(range(len(ra)), key=lambda i: -ra[i]["similarityScore"])
        row_rank, uniq_rank, seen = {}, {}, []
        for pos, i in enumerate(order, 1):
            sid = str(ra[i]["scholarId"])
            row_rank.setdefault(sid, (pos, ra[i]))
            if sid not in seen:
                seen.append(sid); uniq_rank[sid] = len(seen)
        for sid in CORE5:
            rr, e = row_rank[sid]
            rows.append(dict(verse=vlabel, rep=rep["replication"], sid=sid, name=CORE5[sid],
                             path=path(vlabel, sid), row_rank=rr, pool_rows=len(ra),
                             uniq_rank=uniq_rank[sid], pool_uniq=len(seen), pool_true=TRUE_POOL[vlabel],
                             score=e["similarityScore"], chars=e["chars"]))
r1 = [r for r in rows if r["rep"] == 1]
out(f"    {'ayet':10s} {'mufessir':16s} {'yol':6s} {'rank(satir)':>12s} {'rank(tekil)':>12s} {'yuzdelik':>9s} {'skor':>8s} {'chars':>8s}")
for r in sorted(r1, key=lambda x: (x["verse"], x["row_rank"])):
    rr = "%d/%d" % (r["row_rank"], r["pool_rows"])
    ur = "%d/%d" % (r["uniq_rank"], r["pool_true"])
    out(f"    {r['verse']:10s} {r['name']:16s} {r['path']:6s} {rr:>12s} {ur:>12s} "
        f"{100*r['uniq_rank']/r['pool_true']:8.1f}% {r['score']:8.4f} {r['chars']:8,d}")
jit = defaultdict(set)
for r in rows: jit[(r["verse"], r["sid"])].add(r["row_rank"])
uns = {k: v for k, v in jit.items() if len(v) > 1}
out(f"    rep-kararliligi (r1/r2/r3): {'20/20 hucre SABIT' if not uns else 'OYNAMA '+str(uns)}")
out(f"    top-10 icinde Core-5: {sum(1 for r in r1 if r['uniq_rank'] <= 10)}/20 hucre  "
    f"(en iyi rank = {min(r['uniq_rank'] for r in r1)})")

# ---- 2. yola gore dagilim
out("\n[2] RANK DAGILIMI, YOLA GORE (r1, 20 hucre)")
for p, nm in [("P","parent-only"), ("C","chunk-only ")]:
    s = [r for r in r1 if r["path"] == p]
    ur = sorted(r["uniq_rank"] for r in s)
    pc = [100*r["uniq_rank"]/r["pool_true"] for r in s]
    ch = [r["chars"] for r in s]
    out(f"    {nm} n={len(s):2d} | tekil-rank min={min(ur)} medyan={st.median(ur):.1f} maks={max(ur)}"
        f" | havuz-yuzdeligi medyan={st.median(pc):.1f}% aralik={min(pc):.1f}-{max(pc):.1f}%"
        f" | chars medyan={st.median(ch):,.0f}")
    out(f"                 ranklar={ur}")
    out(f"                 chars/yuzdelik Spearman rho = {spearman(ch, pc):+.3f}")
out("    UYARI (konfound): chunk-yolu hucreleri tam olarak UZUN serhlerdir")
out("    (chunk medyan 22.293 chars vs parent 1.881) — yol ile uzunluk ic ice.")
out("\n    uzunluk-esli karsilastirma (ayet-ici, 24:35):")
for r in sorted([x for x in r1 if x["verse"] == "24:35"], key=lambda x: x["chars"]):
    yol = "parent" if r["path"] == "P" else "chunk "
    out(f"      {r['name']:16s} {yol:6s} chars={r['chars']:7,d}  "
        f"rank={r['uniq_rank']:2d}/{r['pool_uniq']} ({100*r['uniq_rank']/r['pool_true']:.1f}%)")

# ---- 3. prompt-slot dolulugu (yalniz admissible firsatlar)
out("\n[3] PROMPT-SLOT DOLULUGU — 63 run, yalniz ADMISSIBLE firsatlar")
grp = defaultdict(lambda: defaultdict(lambda: [0,0])); cell = defaultdict(lambda: [0,0])
for r in runs:
    v, pre = r["verse"]["label"], r["presetName"]
    g = {"core5":"core5 (M1-M3)", "allN":"allN  (M4-M5)"}.get(pre, "extended (M6)")
    adm = set(map(str, r["scholarIds"])) if r["scholarIds"] else None   # None = allN, havuzun tamami
    inc = to_ids(r["prompt_included"])
    for sid in CORE5:
        if adm is not None and sid not in adm: continue
        p = path(v, sid); h = 1 if sid in inc else 0
        grp[g][p][0] += h; grp[g][p][1] += 1
        cell[(g, v, sid, p)][0] += h; cell[(g, v, sid, p)][1] += 1
for g in ["core5 (M1-M3)", "allN  (M4-M5)", "extended (M6)"]:
    t = [0,0]; parts = []
    for p, nm in [("P","parent"), ("C","chunk")]:
        h, n = grp[g][p]; t[0]+=h; t[1]+=n
        parts.append(f"{nm} {h}/{n}" + (f" ({100*h/n:.0f}%)" if n else ""))
    out(f"    {g:16s} " + " | ".join(parts) + f" | TOPLAM {t[0]}/{t[1]}")
out("    kacirilan slotlar (admissible, prompt'ta yok) — allN disi:")
for (g, v, sid, p), (h, n) in sorted(cell.items()):
    if h < n and not g.startswith("allN"):
        out(f"      {g:16s} {v:10s} {CORE5[sid]:16s} yol={p}  {h}/{n}")

# ---- 4. 27:18-19 alt-kumesi
out("\n[4] ALT-KUME 27:18-19 — 10/10 doluluk hucresi parent-only")
s = [r for r in r1 if r["verse"] == "27:18-19"]
out(f"    havuz: {s[0]['pool_true']} tekil mufessir (vektorlu, DB); probe k=95 dilimi {s[0]['pool_rows']} satir / {s[0]['pool_uniq']} tekil")
for r in sorted(s, key=lambda x: x["uniq_rank"]):
    out(f"      {r['name']:16s} parent  rank {r['uniq_rank']:2d}/{r['pool_true']} "
        f"({100*r['uniq_rank']/r['pool_true']:.1f}%)  skor={r['score']:.4f}  chars={r['chars']:,d}")
allN = [r for r in runs if r["presetName"] == "allN" and r["verse"]["label"] == "27:18-19"]
hit = sum(1 for r in allN for sid in CORE5 if sid in to_ids([e["scholarName"] for e in r["retrieved_all"]]))
out(f"    allN top-10 icinde Core-5: {hit}/{len(allN)*5}")
out("    core5-preset (M1-M3) 27:18-19: al-Razi 0/9 slot — mukerrer satirlar (Ibn Kathir x2,")
out("    al-Tabari x2) ilk 6 slotu doldurdu, Razi rank 7-8'de kaldi. Parent-yolu, chunk degil.")

open("kite_core5_path_ranks.out.txt", "w").write("\n".join(L) + "\n")
