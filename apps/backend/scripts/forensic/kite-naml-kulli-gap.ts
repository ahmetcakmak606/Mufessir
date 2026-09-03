#!/usr/bin/env node
/**
 * kite-naml-kulli-gap.ts — READ-ONLY forensik sorgu (KAPI)
 *
 * Tarih: 2026-09-03
 * Amaç:  27:18-19 havuzunda BULUNMAYAN 7 küllî (42-set) müfessir için:
 *        satır var mı / embedding var mı? İki senaryo ayrışır:
 *          (a) satır YOK            → korpus yokluğu (sıralamaya hiç giremezdi)
 *          (b) satır VAR, vektör YOK → İNDEKSLEME BOŞLUĞU (havuz sonucu kirli)
 *        (b) çıkarsa 27:18-19'un ∩42=35 tavanı ve §4.1'in "indeksleme boşluğu
 *        değil" ifadesi bu âyet için yeniden ele alınır.
 *
 * Izgara: 7 müfessir × 2 verse_id (27-18, 27-19) = 14 hücre.
 * Tek SQL statement, read-only. Yazma yok.
 *
 * Çalıştır: npx tsx apps/backend/scripts/forensic/kite-naml-kulli-gap.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const prisma = new PrismaClient();

// 27:18-19 havuzunda satırı bulunmayan 42-set üyeleri (kite_pool42_intersection.py çıktısı)
const IDS = [9, 28, 33, 38, 75, 88, 97];

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    WITH verses(verse_id) AS (VALUES ('27-18'),('27-19')),
         scholars(mufassir_id) AS (VALUES (9),(28),(33),(38),(75),(88),(97)),
         grid AS (SELECT v.verse_id, s.mufassir_id FROM verses v CROSS JOIN scholars s),
         at AS (
           SELECT verse_id, mufassir_id,
                  COUNT(*)::int AS satir,
                  COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embed_dolu,
                  MAX(length(commentary))::int AS max_chars
           FROM all_tafsirs
           WHERE verse_id IN ('27-18','27-19') AND mufassir_id IN (9,28,33,38,75,88,97)
           GROUP BY verse_id, mufassir_id
         ),
         ch AS (
           SELECT verse_id, mufassir_id,
                  COUNT(*)::int AS chunk_satir,
                  COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS chunk_embed_dolu
           FROM tafsir_chunks
           WHERE verse_id IN ('27-18','27-19') AND mufassir_id IN (9,28,33,38,75,88,97)
           GROUP BY verse_id, mufassir_id
         )
    SELECT g.verse_id AS ayet,
           g.mufassir_id AS mid,
           COALESCE(m.mufassir_tr, m.mufassir_en, m.mufassir_ar, '?') AS ad,
           COALESCE(at.satir, 0) AS at_satir,
           COALESCE(at.embed_dolu, 0) AS at_embed_dolu,
           at.max_chars AS at_chars,
           COALESCE(ch.chunk_satir, 0) AS chunk_satir,
           COALESCE(ch.chunk_embed_dolu, 0) AS chunk_embed_dolu,
           CASE
             WHEN COALESCE(at.satir,0) = 0 THEN 'SATIR YOK (korpus yoklugu)'
             WHEN COALESCE(at.embed_dolu,0) + COALESCE(ch.chunk_embed_dolu,0) > 0 THEN 'vektor VAR'
             ELSE 'SATIR VAR, VEKTOR YOK (indeksleme bosluğu)'
           END AS tani
    FROM grid g
    LEFT JOIN mufassirs m ON m.mufassir_id = g.mufassir_id
    LEFT JOIN at ON at.verse_id = g.verse_id AND at.mufassir_id = g.mufassir_id
    LEFT JOIN ch ON ch.verse_id = g.verse_id AND ch.mufassir_id = g.mufassir_id
    ORDER BY g.mufassir_id, g.verse_id
  `);

  console.table(rows);

  const say = (t: string) => rows.filter((r) => r.tani === t).length;
  console.log(`\nToplam hücre: ${rows.length}`);
  console.log(`  SATIR YOK (korpus yokluğu)          : ${say("SATIR YOK (korpus yoklugu)")}`);
  console.log(`  SATIR VAR, VEKTOR YOK (indeksleme)  : ${say("SATIR VAR, VEKTOR YOK (indeksleme bosluğu)")}`);
  console.log(`  vektör VAR                           : ${say("vektor VAR")}`);

  const gap = rows.filter((r) => r.tani.startsWith("SATIR VAR, VEKTOR YOK"));
  if (gap.length > 0) {
    console.log("\n*** KAPI AÇILMADI — indeksleme boşluğu var: ***");
    for (const g of gap) console.log(`   ${g.ayet} × ${g.ad} (mid=${g.mid}) chars=${g.at_chars}`);
  }
  const vec = rows.filter((r) => r.tani === "vektor VAR");
  if (vec.length > 0) {
    console.log("\n*** DİKKAT — vektörü olduğu hâlde havuzda görünmeyen hücre: ***");
    for (const v of vec) console.log(`   ${v.ayet} × ${v.ad} (mid=${v.mid})`);
  }

  // --- 2. GERÇEK havuz: 27-18 ∪ 27-19'da vektörü olan tüm müfessirler ---
  console.log("\n=== 27:18-19 GERÇEK havuz (k-diliminden bağımsız) ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    WITH vec AS (
      SELECT DISTINCT t.verse_id, t.mufassir_id FROM all_tafsirs t
      WHERE t.verse_id IN ('27-18','27-19')
        AND (t.embedding IS NOT NULL
             OR EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL))
    )
    SELECT 'per-ayet' AS kirilim, verse_id AS ayet, COUNT(*)::int AS vektorlu_mufessir FROM vec GROUP BY verse_id
    UNION ALL SELECT 'birlesim', '27-18 u 19', COUNT(DISTINCT mufassir_id)::int FROM vec
  `));
  const ids = await prisma.$queryRawUnsafe<any[]>(`
    SELECT DISTINCT t.mufassir_id AS mid FROM all_tafsirs t
    WHERE t.verse_id IN ('27-18','27-19')
      AND (t.embedding IS NOT NULL
           OR EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL))
  `);
  const k42 = new Set(readFileSync(
    "/Users/csapanca/CascadeProjects/Obsidian/02_Projects/MufessirAI_Project/cuneyt_mehmet_coding/c1-kodlama/kulli42_ids.txt",
    "utf-8").trim().split("\n").map((x) => x.trim()));
  const all = ids.map((r) => String(r.mid));
  const inter = all.filter((m) => k42.has(m));
  console.log(`GERÇEK havuz (birleşim, vektörlü): ${all.length} müfessir`);
  console.log(`  ∩ 42-set = ${inter.length}   |  k=95 diliminde görünen: 35`);
  console.log(`  42-set'in gerçekten havuzda olmayan üyesi: ${42 - inter.length}` +
              ` (${[...k42].filter((m) => !all.includes(m as string)).join(", ") || "—"})`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
