#!/usr/bin/env tsx
/**
 * Imports tafsir data from quran_tafseers.db (SQLite) into Railway PostgreSQL.
 * Source table: tefsir_altafsir (sure_no, aya_no, mufessirID, commentary)
 * Covers 16 surahs × ~40 scholars.
 *
 * Skips surahs already fully populated in Railway (1, 2, 5).
 * Skips mufessirID=0 (unidentified).
 * mufessirID values match Railway mufassir_id directly.
 */

import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import os from "os";

const { Client } = pg;

const SQLITE_PATH = path.join(
  os.homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/sqlite/quran_tafseers.db",
);

const DST =
  "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

const SKIP_SURAHS = new Set([1, 2, 5]); // already populated
const BATCH = 500;

async function main() {
  const db = new DatabaseSync(SQLITE_PATH, { open: true });
  const dst = new Client({ connectionString: DST });
  await dst.connect();
  console.log("Connected to Railway.\n");

  // Verify mufassir IDs exist in Railway
  const { rows: mufassirs } = await dst.query(
    `SELECT mufassir_id FROM mufassirs ORDER BY mufassir_id`,
  );
  const validMufassirIds = new Set(mufassirs.map((r: any) => Number(r.mufassir_id)));
  console.log(`Railway has ${validMufassirIds.size} mufassirs.\n`);

  // Get max existing id
  const { rows: maxRow } = await dst.query(
    `SELECT COALESCE(MAX(id::bigint), 0) AS max_id FROM all_tafsirs`,
  );
  let nextId = Number(maxRow[0].max_id) + 1;

  // Read all rows from tefsir_altafsir
  const rows = db
    .prepare(
      `SELECT sure_no, aya_no, mufessirID, commentary
       FROM tefsir_altafsir
       WHERE mufessirID != 0
         AND commentary IS NOT NULL
         AND LENGTH(TRIM(commentary)) > 10
       ORDER BY mufessirID, sure_no, aya_no`,
    )
    .all() as Array<{
      sure_no: number;
      aya_no: number;
      mufessirID: number;
      commentary: string;
    }>;

  console.log(`Read ${rows.length} rows from SQLite.\n`);

  let inserted = 0;
  let skippedSurah = 0;
  let skippedMufassir = 0;
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
    batch.length = 0;
    process.stdout.write(`  inserted ${inserted}\r`);
  };

  for (const row of rows) {
    if (SKIP_SURAHS.has(row.sure_no)) {
      skippedSurah++;
      continue;
    }
    if (!validMufassirIds.has(row.mufessirID)) {
      skippedMufassir++;
      continue;
    }
    const verseId = `${row.sure_no}-${row.aya_no}`;
    batch.push([nextId++, verseId, row.mufessirID, row.commentary]);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  console.log(`\n\nDone!`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped (existing surahs 1,2,5): ${skippedSurah}`);
  console.log(`  Skipped (unknown mufassirID): ${skippedMufassir}`);

  // Summary by surah
  const { rows: summary } = await dst.query(
    `SELECT split_part(verse_id,'-',1)::int AS surah,
            COUNT(DISTINCT mufassir_id)::int AS scholars,
            COUNT(*)::int AS tafsirs
     FROM all_tafsirs
     WHERE verse_id ~ '^\\d+-\\d+$'
     GROUP BY 1 ORDER BY 1`,
  );

  console.log(`\nRailway all_tafsirs by surah:`);
  for (const r of summary) {
    const flag = SKIP_SURAHS.has(r.surah) ? " (pre-existing)" : "";
    console.log(`  Surah ${String(r.surah).padEnd(4)} ${String(r.scholars).padEnd(4)} scholars  ${r.tafsirs} tafsirs${flag}`);
  }

  // Scholar coverage summary
  const { rows: scholarSummary } = await dst.query(
    `SELECT m.mufassir_id, COALESCE(m.mufassir_en, m.mufassir_tr) AS name,
            COUNT(DISTINCT split_part(t.verse_id,'-',1))::int AS surah_count,
            COUNT(*)::int AS tafsir_count
     FROM mufassirs m
     JOIN all_tafsirs t ON t.mufassir_id = m.mufassir_id
     WHERE t.verse_id ~ '^\\d+-\\d+$'
     GROUP BY m.mufassir_id, m.mufassir_en, m.mufassir_tr
     ORDER BY surah_count DESC, tafsir_count DESC`,
  );
  console.log(`\nTop scholars by surah coverage:`);
  for (const r of scholarSummary.slice(0, 20)) {
    console.log(`  [${r.mufassir_id}] ${(r.name || "").padEnd(40)} ${r.surah_count} surahs  ${r.tafsir_count} tafsirs`);
  }

  db.close?.();
  await dst.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
