#!/usr/bin/env node
/**
 * kite-chunk-invariant.ts  — READ-ONLY forensik sorgu
 *
 * Tarih: 2026-09-03
 * Amaç:  (a) Chunk'lama eşiklerini gerçek örnekle doğrula (char gate 20000 +
 *            token gate 8192; generate-chunks.ts). 24:35 Taberî 22293 char →
 *            token sayısı 8192'yi aşıyor mu?
 *        (b) "Çift durum" değişmezi: bugün all_tafsirs.embedding NOT NULL VE
 *            aynı satırın chunk'ı olan (parent+chunk ikisi de gömülü) kaç satır
 *            var? 0 ise §4.1'in "chunk/whole yarışı" fiilen yaşanmaz
 *            (mufassir-ayet başına vektör tek kaynaktan gelir).
 *
 * Read-only. Yazma yok.
 * Çalıştır: npx tsx apps/backend/scripts/forensic/kite-chunk-invariant.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
// NOT: token sayımı için gpt-tokenizer gerekmiyor. generate-chunks.ts:173-174
// yalnız cl100k token > 8192 iken chunk üretir → chunk'ı olan satırın token'ı
// ispatlı >8192. Eşik değerleri koddan sabittir (char>20000 aday + token>8192).

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });
const prisma = new PrismaClient();

const RUN_VERSES = ["3-7", "24-35", "20-5", "27-18", "27-19"];
const CORE5 = [7, 19, 22, 24, 29];

async function main() {
  // (b) GLOBAL çift-durum: parent embedding dolu VE chunk'ı var
  const dbl = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::int AS cift_durum_satir
    FROM all_tafsirs t
    WHERE t.embedding IS NOT NULL
      AND EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id)
  `);
  console.log("=== (b) GLOBAL çift-durum (parent embedding dolu + chunk'ı var) ===");
  console.table(dbl);

  // (b) Koşum ayetleri × Core-5 için kaynak kırılımı: satır nereden puanlanır
  const src = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t.verse_id AS ayet, t.mufassir_id AS mid,
           char_length(t.commentary) AS chars,
           (t.embedding IS NOT NULL) AS parent_embed,
           (SELECT COUNT(*)::int FROM tafsir_chunks c WHERE c.parent_id = t.id) AS chunk_satir,
           (SELECT COUNT(*)::int FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL) AS chunk_embed,
           CASE
             WHEN t.embedding IS NOT NULL AND EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id) THEN 'ÇİFT (yarış!)'
             WHEN t.embedding IS NOT NULL THEN 'yalniz parent'
             WHEN EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL) THEN 'yalniz chunk'
             ELSE 'VEKTOR YOK'
           END AS kaynak
    FROM all_tafsirs t
    WHERE t.verse_id = ANY($1::text[]) AND t.mufassir_id = ANY($2::int[])
    ORDER BY t.verse_id, t.mufassir_id
  `, RUN_VERSES, CORE5);
  console.log("\n=== koşum ayetleri × Core-5: skor kaynağı (parent mi chunk mı) ===");
  console.table(src);

  // (a) Eşik doğrulaması: koşum ayetleri × Core-5 char + chunk sayısı.
  //     char>20000 aday gate; chunk varlığı token>8192'yi ispatlar.
  const gate = await prisma.$queryRawUnsafe<any[]>(`
    SELECT t.verse_id AS ayet, t.mufassir_id AS mid,
           char_length(t.commentary) AS chars,
           (SELECT COUNT(*)::int FROM tafsir_chunks c WHERE c.parent_id = t.id) AS chunk_satir,
           (char_length(t.commentary) > 20000) AS char_gate_20000_gecti,
           (EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id)) AS chunklandi_token_8192_ustu
    FROM all_tafsirs t
    WHERE t.verse_id = ANY($1::text[]) AND t.mufassir_id = ANY($2::int[])
    ORDER BY chars
  `, RUN_VERSES, CORE5);
  console.log("\n=== (a) eşik: char>20000 aday gate + chunk varlığı = token>8192 ispatı ===");
  console.table(gate);

  // (a-global) Ampirik char crossover: chunk'lanmış parent'ların min char'ı vs
  //   chunk'sız (embedding dolu) parent'ların max char'ı. Token gate (~8192) char'a
  //   1.39 oran (former/embed-test-verses.ts) ile ~11.4k char'a denk gelir; overlap beklenir.
  const cross = await prisma.$queryRawUnsafe<any[]>(`
    WITH parents AS (
      SELECT t.id, char_length(t.commentary) AS chars,
             EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id) AS chunklu,
             (t.embedding IS NOT NULL) AS parent_embed
      FROM all_tafsirs t
    )
    SELECT
      MIN(chars) FILTER (WHERE chunklu)                       AS chunklu_min_char,
      MAX(chars) FILTER (WHERE chunklu)                       AS chunklu_max_char,
      MIN(chars) FILTER (WHERE NOT chunklu AND parent_embed)  AS chunksuz_dolu_min_char,
      MAX(chars) FILTER (WHERE NOT chunklu AND parent_embed)  AS chunksuz_dolu_max_char,
      COUNT(*)   FILTER (WHERE chunklu)::int                  AS chunklu_parent_sayisi
    FROM parents
  `);
  console.log("\n=== (a-global) ampirik char crossover (chunklu vs chunksuz-dolu) ===");
  console.table(cross);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
