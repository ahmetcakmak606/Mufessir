#!/usr/bin/env tsx
/**
 * Imports tafsir data from quran_db.db (SQLite) into Railway PostgreSQL.
 * Source: ~/Library/Mobile Documents/com~apple~CloudDocs/sqlite/quran_db.db
 * Tables: 01_Taberi, 02_ibnKesir, 03_Kurtubi, 04_Bagavi
 *
 * Only imports surahs that don't already have tafsirs in Railway.
 * verse_id format: 'SurahID-AyahID' (e.g., '86-1')
 */

import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import os from "os";

const { Client } = pg;

const SQLITE_PATH = path.join(
  os.homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/sqlite/quran_db.db",
);

const DST =
  "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

// Maps SQLite table name → Railway mufassir_id
// Verified against Railway mufassirs table: Al-Tabari=7, Ibn Kathir=29, Al-Qurtubi=24
const TAFSIR_TABLES: Array<{ table: string; mufassirId: number; label: string }> = [
  { table: "01_Taberi", mufassirId: 7, label: "Al-Tabari" },
  { table: "02_ibnKesir", mufassirId: 29, label: "Ibn Kathir" },
  { table: "03_Kurtubi", mufassirId: 24, label: "Al-Qurtubi" },
  { table: "04_Bagavi", mufassirId: 0, label: "Al-Baghawi (TBD)" }, // ID looked up below
];

const BATCH = 500;

async function main() {
  const db = new DatabaseSync(SQLITE_PATH, { open: true });
  const dst = new Client({ connectionString: DST });
  await dst.connect();
  console.log("Connected to Railway.\n");

  // Find Al-Baghawi mufassir ID in Railway
  const { rows: baghawi } = await dst.query(
    `SELECT mufassir_id FROM mufassirs WHERE mufassir_en ILIKE '%baghawi%' OR mufassir_ar ILIKE '%بغوي%' LIMIT 1`,
  );
  if (baghawi[0]) {
    TAFSIR_TABLES[3].mufassirId = baghawi[0].mufassir_id;
    TAFSIR_TABLES[3].label = `Al-Baghawi (id=${baghawi[0].mufassir_id})`;
  } else {
    console.warn("Al-Baghawi mufassir not found in Railway, skipping 04_Bagavi.");
    TAFSIR_TABLES.splice(3, 1);
  }

  // Find which surahs already have tafsirs in Railway
  const { rows: existingSuras } = await dst.query(
    `SELECT DISTINCT split_part(verse_id, '-', 1)::int AS surah
     FROM all_tafsirs
     WHERE verse_id ~ '^\\d+-\\d+$'`,
  );
  const skippedSuras = new Set(existingSuras.map((r: any) => Number(r.surah)));
  console.log(`Surahs already in Railway: ${[...skippedSuras].sort((a, b) => a - b).join(", ")}`);
  console.log(`Skipping those surahs to avoid duplicates.\n`);

  // Get max existing id
  const { rows: maxRow } = await dst.query(
    `SELECT COALESCE(MAX(id::bigint), 0) AS max_id FROM all_tafsirs`,
  );
  let nextId = Number(maxRow[0].max_id) + 1;

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const { table, mufassirId, label } of TAFSIR_TABLES) {
    if (mufassirId === 0) continue;
    console.log(`Processing ${table} (${label}, mufassir_id=${mufassirId})...`);

    const rows = db
      .prepare(
        `SELECT SurahID, AyahID, Tafseer
         FROM "${table}"
         WHERE Tafseer IS NOT NULL AND LENGTH(TRIM(Tafseer)) > 10
         ORDER BY SurahID, AyahID`,
      )
      .all() as Array<{ SurahID: number; AyahID: number; Tafseer: string }>;


    let inserted = 0;
    let skipped = 0;
    const batch: Array<[number, string, number, string]> = [];

    const flush = async () => {
      if (batch.length === 0) return;
      const placeholders = batch
        .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
        .join(", ");
      const values = batch.flat();
      await dst.query(
        `INSERT INTO all_tafsirs (id, verse_id, mufassir_id, commentary)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING`,
        values,
      );
      inserted += batch.length;
      totalInserted += batch.length;
      batch.length = 0;
    };

    for (const row of rows) {
      if (skippedSuras.has(row.SurahID)) {
        skipped++;
        totalSkipped++;
        continue;
      }
      const verseId = `${row.SurahID}-${row.AyahID}`;
      batch.push([nextId++, verseId, mufassirId, row.Tafseer]);
      if (batch.length >= BATCH) await flush();
    }
    await flush();

    console.log(`  → inserted ${inserted}, skipped ${skipped} (existing surahs)`);
  }

  console.log(`\nDone! Total inserted: ${totalInserted}, total skipped: ${totalSkipped}`);

  // Verify
  const { rows: final } = await dst.query(
    `SELECT split_part(verse_id, '-', 1)::int AS surah, COUNT(*)::int AS cnt
     FROM all_tafsirs WHERE verse_id ~ '^\\d+-\\d+$'
     GROUP BY 1 ORDER BY 1`,
  );
  console.log(`\nRailway all_tafsirs by surah (top 20):`);
  for (const r of final.slice(0, 20)) {
    console.log(`  Surah ${r.surah}: ${r.cnt} tafsirs`);
  }
  if (final.length > 20) console.log(`  ... and ${final.length - 20} more surahs`);

  db.close?.();
  await dst.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
