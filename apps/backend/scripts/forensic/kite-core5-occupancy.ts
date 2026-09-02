#!/usr/bin/env node
/**
 * kite-core5-occupancy.ts  — READ-ONLY forensik sorgu
 *
 * Tarih:  2026-09-02
 * Amaç:   KITE 63-run (batchId kulliyyah-kite-2026-06-22-v1) §4.1 bulgusunun
 *         ön-koşulu: koşum ayetlerinde Core-5 müfessirlerinin all_tafsirs'te
 *         BUGÜN embedding'i var mı? Bir müfessirin bir ayette hiç vektörü
 *         yoksa, o müfessir sıralamada kaybetmedi — sıralamaya hiç girmedi.
 *
 * Kırılım: 5 ayet × 5 müfessir = 25 hücre. Her hücre için:
 *   - all_tafsirs: satır var mı, kaç satır embedding dolu, chars (max commentary)
 *   - tafsir_chunks: o müfessir-ayet çiftinde chunk satırı + embedding dolu sayısı
 *     (uzun şerhler oradan gelmiş olabilir; ikisi birlikte bakılır)
 *
 * Tek SQL statement (read-only). Yazma yok.
 *
 * Çalıştır: npx tsx apps/backend/scripts/forensic/kite-core5-occupancy.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const prisma = new PrismaClient();

// Core-5 (SCHOLAR_PRESETS.core5): Taberî 7, Zemahşerî 19, Râzî 22, Kurtubî 24, İbn Kesîr 29
// Koşum ayetleri (dash format — all_tafsirs.verse_id doğrulandı)
async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    WITH verses(verse_id) AS (VALUES ('3-7'),('24-35'),('20-5'),('27-18'),('27-19')),
         scholars(mufassir_id) AS (VALUES (7),(19),(22),(24),(29)),
         grid AS (SELECT v.verse_id, s.mufassir_id FROM verses v CROSS JOIN scholars s),
         at AS (
           SELECT verse_id, mufassir_id,
                  COUNT(*)::int AS satir,
                  COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embed_dolu,
                  MAX(length(commentary))::int AS max_chars
           FROM all_tafsirs
           WHERE verse_id IN ('3-7','24-35','20-5','27-18','27-19')
             AND mufassir_id IN (7,19,22,24,29)
           GROUP BY verse_id, mufassir_id
         ),
         ch AS (
           SELECT verse_id, mufassir_id,
                  COUNT(*)::int AS chunk_satir,
                  COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS chunk_embed_dolu
           FROM tafsir_chunks
           WHERE verse_id IN ('3-7','24-35','20-5','27-18','27-19')
             AND mufassir_id IN (7,19,22,24,29)
           GROUP BY verse_id, mufassir_id
         )
    SELECT g.verse_id AS ayet,
           g.mufassir_id AS mid,
           COALESCE(m.mufassir_en, m.mufassir_tr, m.mufassir_ar, '?') AS ad,
           COALESCE(at.satir, 0) AS at_satir,
           COALESCE(at.embed_dolu, 0) AS at_embed_dolu,
           at.max_chars AS at_chars,
           COALESCE(ch.chunk_satir, 0) AS chunk_satir,
           COALESCE(ch.chunk_embed_dolu, 0) AS chunk_embed_dolu,
           (COALESCE(at.embed_dolu,0) + COALESCE(ch.chunk_embed_dolu,0) > 0) AS vektor_var
    FROM grid g
    LEFT JOIN mufassirs m ON m.mufassir_id = g.mufassir_id
    LEFT JOIN at ON at.verse_id = g.verse_id AND at.mufassir_id = g.mufassir_id
    LEFT JOIN ch ON ch.verse_id = g.verse_id AND ch.mufassir_id = g.mufassir_id
    ORDER BY g.verse_id, g.mufassir_id
  `);

  console.table(rows);

  const bosluk = rows.filter((r) => r.vektor_var === false);
  console.log(`\nToplam hücre: ${rows.length} | vektörü OLMAYAN hücre: ${bosluk.length}`);
  if (bosluk.length > 0) {
    console.log("BOŞLUK (ne all_tafsirs ne chunk'ta embedding):");
    for (const b of bosluk) console.log(`  ${b.ayet} × ${b.ad} (mid=${b.mid})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
