#!/usr/bin/env python3
"""
kite_probe31_ranks.py — Committed provenance for the §3.1 k-sweep rank findings.

Reads the §3.1 increasing-k probe trace (kite-probe31.jsonl) and:
  1. Verifies k-slice prefix consistency: each k-slice must be an exact prefix
     (tafsirId + full-precision similarityScore) of the next. Passing this check
     means all slices derive from a single consistent retrieval ordering — the
     rank comparisons across k are internally coherent and unaffected by the
     score-level embedding jitter observed across harness replications.
  2. Mechanically extracts Core-5 ranks in the largest slice (rank X / pool N).
  3. Reports pool size (unique scholars) and duplicate check.
  4. Emits a machine-readable JSON summary for downstream citation.

Usage:
    python3 kite_probe31_ranks.py kite-probe31.jsonl

Core-5 IDs are the locked values from the pre-commitment note (frozen 2026-06-25).
"""

import json
import sys
from collections import Counter

CORE5 = {"7": "al-Tabari", "19": "al-Zamakhshari", "22": "al-Razi",
         "24": "al-Qurtubi", "29": "Ibn Kathir"}


def main() -> int:
    if len(sys.argv) != 2:
        print("kullanım: python3 kite_probe31_ranks.py kite-probe31.jsonl", file=sys.stderr)
        return 2

    runs = []
    with open(sys.argv[1], encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                runs.append(json.loads(line))

    # Sort slices by length ascending (k=10 → largest).
    runs.sort(key=lambda r: len(r["retrieved_all"]))

    # 1) Prefix consistency across slices.
    def sig(item):
        return (item["tafsirId"], item["similarityScore"])

    prefix_ok = True
    for a in range(len(runs) - 1):
        s, l = runs[a]["retrieved_all"], runs[a + 1]["retrieved_all"]
        ok = [sig(i) for i in l[: len(s)]] == [sig(i) for i in s]
        prefix_ok &= ok
        print(f"prefix: {runs[a]['runId']} ⊂ {runs[a+1]['runId']}: {'OK' if ok else 'FAIL'}")
    if not prefix_ok:
        print("HATA: k-dilimleri tek bir tutarlı sıralamadan türememiş — "
              "rank karşılaştırmaları geçersiz.", file=sys.stderr)
        return 1

    # 2) Core-5 ranks in the largest slice.
    largest = runs[-1]
    pool = largest["retrieved_all"]
    n = len(pool)
    verse = largest["verse"]["label"]
    print(f"\nen büyük dilim: {largest['runId']} — {verse}, havuz = {n} satır")

    ranks = {}
    for rank, item in enumerate(pool, 1):
        sid = str(item["scholarId"])
        if sid in CORE5:
            ranks[sid] = {"rank": rank, "pool": n,
                          "score": item["similarityScore"], "chars": item["chars"]}
            print(f"  rank {rank:>3}/{n}  id={sid:>3}  {CORE5[sid]:<16} "
                  f"skor={item['similarityScore']:.6f}  chars={item['chars']}")
    missing = [CORE5[s] for s in CORE5 if s not in ranks]
    print(f"  havuzda bulunamayan Core-5: {missing or '—'}")

    # 3) Duplicate check.
    c = Counter(str(i["scholarId"]) for i in pool)
    dups = {k: v for k, v in c.items() if v > 1}
    print(f"\ntekil müfessir: {len(c)}/{n}  mükerrer: {dups or 'yok'}")

    # 4) Machine-readable summary.
    print(json.dumps({
        "verse": verse,
        "pool_rows": n,
        "unique_scholars": len(c),
        "duplicates": dups,
        "prefix_consistent": prefix_ok,
        "core5_ranks": {CORE5[s]: v for s, v in ranks.items()},
        "core5_missing_from_pool": missing,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
