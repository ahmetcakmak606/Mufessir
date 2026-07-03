#!/usr/bin/env python3
"""
kite_probe31_v2_analyze.py — 4-âyet k-sweep analizi (12 run, 3 rep/âyet). [düzeltilmiş]

Girdi: kite-probe31-v2.jsonl (harness çıktısı; analiz yalnız retrieved_all katmanı)

v2-taslağa göre düzeltmeler (2026-07-02 oturumu):
  - Kararlılık: tüm-havuz Jaccard DEĞİL (k=max'ta dejenere, ≈1.0) →
    top-10 / top-20 üyelik-Jaccard + Core-5 rank oynaması (max−min, rep'ler arası).
  - Totolojik prefix-kontrolü kaldırıldı (pool[:k] dilimleri inşa gereği tutarlı).
  - Spearman: ortalama-rank tie yönetimi + rank'ler üzerinde Pearson; ρ=0.0 korunur.
  - Tekil-müfessir envanteri (Naml âyet-satırı mükerrerliği için satır ≠ müfessir).
  - k→isabet eğrisi: |Core-5 ∩ top-k| (müfessir-düzeyi), k=10/20/50/95 — §3.1'in
    alıntılanacak ana tablosu.
  - Kanonik rep = r1 (rank'ler ondan raporlanır); rep-drift ayrı satır.

Kullanım: python3 kite_probe31_v2_analyze.py kite-probe31-v2.jsonl
"""

import json
import sys
from collections import Counter, defaultdict
from itertools import combinations

CORE5 = {"7": "al-Tabari", "19": "al-Zamakhshari", "22": "al-Razi",
         "24": "al-Qurtubi", "29": "Ibn Kathir"}
K_SLICES = (10, 20, 50, 95)
STABILITY_KS = (10, 20)


def spearman_rho(x, y):
    """Spearman ρ: ortalama-rank tie yönetimi, rank'ler üzerinde Pearson."""
    n = len(x)
    if n < 3:
        return None

    def avg_ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2 + 1
            for t in range(i, j + 1):
                r[order[t]] = avg
            i = j + 1
        return r

    rx, ry = avg_ranks(x), avg_ranks(y)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return num / den if den else None


def jaccard(a, b):
    sa, sb = set(a), set(b)
    return len(sa & sb) / len(sa | sb) if (sa | sb) else 1.0


def scholar_ids(pool):
    return [str(i["scholarId"]) for i in pool]


def analyze():
    if len(sys.argv) != 2:
        print("kullanım: python3 kite_probe31_v2_analyze.py kite-probe31-v2.jsonl",
              file=sys.stderr)
        return 2

    runs = []
    with open(sys.argv[1], encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                r = json.loads(line)
                if "error" in r and "retrieved_all" not in r:
                    print(f"UYARI: {r.get('runId','?')} hata kaydı, atlanıyor: "
                          f"{r['error']}", file=sys.stderr)
                    continue
                runs.append(r)

    by_verse = defaultdict(list)
    for r in runs:
        by_verse[r["verse"]["label"]].append(r)

    results = []
    for verse, reps in sorted(by_verse.items()):
        reps.sort(key=lambda r: r["replication"])
        canonical = reps[0]  # kanonik = r1
        pool = canonical["retrieved_all"]
        n_rows = len(pool)
        ids = scholar_ids(pool)

        # Tekil-müfessir envanteri (satır ≠ müfessir; Naml mükerrerliği)
        c = Counter(ids)
        n_unique = len(c)
        dups = {k: v for k, v in c.items() if v > 1}

        # Core-5 rank'leri (kanonik r1; ilk geçiş = en iyi rank)
        core5_ranks = {}
        for rank, item in enumerate(pool, 1):
            sid = str(item["scholarId"])
            if sid in CORE5 and sid not in core5_ranks:
                core5_ranks[sid] = {"rank": rank, "pool_rows": n_rows,
                                    "score": item["similarityScore"],
                                    "chars": item.get("chars", 0)}

        # k→isabet eğrisi (müfessir-düzeyi: top-k satırlardaki TEKİL Core-5 sayısı)
        hits_curve = {}
        for k in K_SLICES:
            if k > n_rows:
                continue
            uniq_in_k = set(ids[:k])
            hits_curve[k] = sum(1 for s in CORE5 if s in uniq_in_k)

        # Rep-kararlılığı: top-10/20 üyelik-Jaccard + Core-5 rank drift
        stability = {}
        for k in STABILITY_KS:
            pair_j = [jaccard(scholar_ids(a["retrieved_all"])[:k],
                              scholar_ids(b["retrieved_all"])[:k])
                      for a, b in combinations(reps, 2)]
            stability[f"top{k}_jaccard_min"] = round(min(pair_j), 4) if pair_j else 1.0

        rank_drift = {}
        for sid, name in CORE5.items():
            per_rep = []
            for r in reps:
                rids = scholar_ids(r["retrieved_all"])
                per_rep.append(rids.index(sid) + 1 if sid in rids else None)
            if all(x is not None for x in per_rep):
                rank_drift[name] = max(per_rep) - min(per_rep)
            else:
                rank_drift[name] = None  # en az bir rep'te havuz-dışı

        # chars ↔ rank Spearman (kanonik r1, tüm havuz; + rank = daha kötü sıra)
        rho = spearman_rho(list(range(1, n_rows + 1)),
                           [i.get("chars", 0) for i in pool])

        top10_chars = sorted(i.get("chars", 0) for i in pool[:10])
        results.append({
            "verse": verse,
            "replications": len(reps),
            "pool_rows_r1": n_rows,
            "unique_scholars_r1": n_unique,
            "duplicates_r1": dups,
            "core5_hits_curve": hits_curve,
            "core5_ranks_r1": {CORE5[k]: v for k, v in core5_ranks.items()},
            "core5_missing_r1": [CORE5[k] for k in CORE5 if k not in core5_ranks],
            "stability": stability,
            "core5_rank_drift": rank_drift,
            "chars_rank_spearman_r1": round(rho, 4) if rho is not None else None,
            "top10_median_chars_r1": top10_chars[len(top10_chars) // 2]
                                     if top10_chars else 0,
        })

    # ── Rapor ──
    print("# KITE Probe31 v2 — 4 Âyet K-Sweep Analizi (kanonik rep = r1)\n")
    for r in results:
        print(f"## {r['verse']} — {r['pool_rows_r1']} satır / "
              f"{r['unique_scholars_r1']} tekil müfessir, {r['replications']} rep"
              + (f", mükerrer: {r['duplicates_r1']}" if r['duplicates_r1'] else ""))
        curve = "  ".join(f"k={k}: {v}" for k, v in sorted(r["core5_hits_curve"].items()))
        print(f"  Core-5 isabet eğrisi (tekil): {curve}")
        print(f"  rep-kararlılık: " +
              "  ".join(f"{k}={v}" for k, v in r["stability"].items()) +
              f"  |  Core-5 rank oynaması: {r['core5_rank_drift']}")
        print(f"  chars/rank Spearman ρ = {r['chars_rank_spearman_r1']}"
              f"  (+ρ: uzun metin → kötü sıra)")
        print(f"  top-10 median chars = {r['top10_median_chars_r1']:,}")
        for name, info in sorted(r["core5_ranks_r1"].items(),
                                 key=lambda x: x[1]["rank"]):
            print(f"    rank {info['rank']:>3}/{info['pool_rows']}  {name:<16}"
                  f"  score={info['score']:.6f}  chars={info['chars']:,}")
        if r["core5_missing_r1"]:
            print(f"  HAVUZDA YOK (r1): {', '.join(r['core5_missing_r1'])}")
        print()

    print(json.dumps({"verses": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(analyze())
