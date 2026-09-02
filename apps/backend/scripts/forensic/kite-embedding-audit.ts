#!/usr/bin/env node
/**
 * kite-embedding-audit.ts  — READ-ONLY forensik sorgu
 *
 * Tarih:  2026-09-02
 * Amaç:   KITE 63-run denetim anlatısı. Koşum ayetlerinde (3-7, 24-35, 20-5,
 *         27-18, 27-19) all_tafsirs.embedding doluluk sayıları + updated_at
 *         aralığı; global doluluk; koşum penceresinden (06-22 19:02Z) sonra
 *         yazılmış (Prisma-seviyesi) satır var mı; tafsir_chunks doluluk.
 *
 * NOT (metodoloji uyarısı): all_tafsirs.embedding yazımları generate-embeddings.ts'te
 *   raw `$executeRaw UPDATE ... SET embedding` ile yapılıyor. Prisma'nın @updatedAt'i
 *   yalnız model-seviyesi yazmalarda tetiklenir → raw UPDATE updated_at'i GÜNCELLEMEZ.
 *   Dolayısıyla updated_at embedding yazım tarihini tanıtlamaz; toplu load/restore
 *   tarihini gösterir. Embedding backfill'i bu sütunda görünmez.
 *
 * Read-only. Yazma yok.
 * Çalıştır: npx tsx apps/backend/scripts/forensic/kite-embedding-audit.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const prisma = new PrismaClient();
const RUN_VERSES = ["3-7", "24-35", "20-5", "27-18", "27-19"];
const RUN_END = "2026-06-22T19:02:22.829Z"; // 63-run son generatedAt (kite-results.jsonl)

async function main() {
  console.log("=== all_tafsirs — koşum ayetleri (doluluk + updated_at) ===");
  console.table(
    await prisma.$queryRawUnsafe<any[]>(
      `SELECT verse_id,
              COUNT(*)::int AS toplam,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS dolu,
              MIN(updated_at) AS ilk, MAX(updated_at) AS son
       FROM all_tafsirs WHERE verse_id = ANY($1::text[]) GROUP BY verse_id ORDER BY verse_id`,
      RUN_VERSES,
    ),
  );

  console.log("\n=== all_tafsirs GENEL (koşum sonrası Prisma-yazması dahil) ===");
  console.table(
    await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS toplam,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS dolu,
              MAX(updated_at) AS en_son_yazim,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL AND updated_at > $1::timestamptz)::int AS kosum_sonrasi_dolu
       FROM all_tafsirs`,
      RUN_END,
    ),
  );

  console.log("\n=== tafsir_chunks GENEL ===");
  console.table(
    await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS toplam, COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS dolu FROM tafsir_chunks`,
    ),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
