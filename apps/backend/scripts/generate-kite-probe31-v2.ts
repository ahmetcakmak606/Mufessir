#!/usr/bin/env node
/**
 * generate-kite-probe31-v2.ts
 * §3.1 Increasing-k probe — 4-verse expansion, production harness.
 *
 * 4 ayet × 3 replication × k=95 = 12 hücre.
 * Harness generation'ı da koşar (production parity); analiz yalnızca
 * retrieved_all üzerinden yapılır, aiResponse kullanılmaz.
 *
 * Not (2026-07-02): 24:35'in yeniden koşulması mükerrer değil — eski probe'un
 * k95 satırı farklı günün embedding'iyle üretilmişti; yeni 3 rep, 24:35 için
 * günler-arası drift karşılaştırması sağlar.
 *
 * Çalıştır:
 *   npx tsx scripts/generate-kite-probe31-v2.ts
 *   npx tsx scripts/run-kite-harness.ts cells-probe31-v2.json kite-probe31-v2.jsonl
 *   python3 kite_probe31_v2_analyze.py kite-probe31-v2.jsonl
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

const VERSES = [
  { label: "3:7", surah: 3, ayahStart: 7, ayahEnd: 7 },
  { label: "20:5", surah: 20, ayahStart: 5, ayahEnd: 5 },
  { label: "24:35", surah: 24, ayahStart: 35, ayahEnd: 35 },
  { label: "27:18-19", surah: 27, ayahStart: 18, ayahEnd: 19 },
];
const K_MAX = 95;
const REPLICATIONS = [1, 2, 3];

interface ProbeCell {
  runId: string;
  cellId: string;
  verse: (typeof VERSES)[number];
  presetName: "allN";
  temperature: number;
  minSimilarity: number;
  limit: number;
  replication: number;
  isTestRun: true;
}

const cells: ProbeCell[] = [];
for (const v of VERSES) {
  for (const rep of REPLICATIONS) {
    cells.push({
      runId: `probe31_${v.label.replace(/:/g, "_")}_k${K_MAX}_r${rep}`,
      cellId: `P31${v.label.replace(/:/g, "").replace("-", "")}k${K_MAX}`,
      verse: v,
      presetName: "allN" as const,
      temperature: 0.7,
      minSimilarity: 0,
      limit: K_MAX,
      replication: rep,
      isTestRun: true,
    });
  }
}

const batch = {
  batchId: "probe31-v2-4verse-3rep",
  generatedAt: new Date().toISOString(),
  note: "§3.1 probe v2: 4 ayet × 3 rep × k=95. Generation production parity ile koşulur; analiz yalnızca retrieved_all katmanında yapılır.",
  cells,
};

const out = resolve(process.cwd(), "cells-probe31-v2.json");
writeFileSync(out, JSON.stringify(batch, null, 2));
console.log(`✅ ${cells.length} hücre → ${out}`);
for (const c of cells) {
  console.log(`   ${c.runId}  verse=${c.verse.label}  limit=${c.limit}  rep=${c.replication}`);
}
