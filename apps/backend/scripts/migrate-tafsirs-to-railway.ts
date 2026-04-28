#!/usr/bin/env tsx
/**
 * Migrates ONLY all_tafsirs from OrbStack (port 5433) to Railway.
 * Preserves Railway's users, searches, favorites, surahs, ayahs, mufassirs.
 *
 * verse_id mapping: OrbStack ayah integer ID → Railway "surah_id-ayah_number" format
 */

import pg from "pg";

const { Client } = pg;

const SRC = "postgresql://postgres:postgres@localhost:5433/MufassirAI_TafsirDB";
const DST = "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";
const BATCH = 2000;

async function main() {
  const src = new Client({ connectionString: SRC });
  const dst = new Client({ connectionString: DST });

  await src.connect();
  await dst.connect();
  console.log("Connected.\n");

  // Build integer_id → "surah_id-ayah_number" map from OrbStack
  console.log("Building ayah ID mapping from OrbStack...");
  const { rows: ayahRows } = await src.query(
    `SELECT id, surah_id, ayah_number FROM mufassirai_tafsirdb.ayahs`
  );
  const idMap = new Map<number, string>();
  for (const r of ayahRows) {
    idMap.set(Number(r.id), `${r.surah_id}-${r.ayah_number}`);
  }
  console.log(`  ${idMap.size} ayah mapping built.\n`);

  // Clear only all_tafsirs (preserve user data)
  console.log("Clearing all_tafsirs on Railway...");
  await dst.query(`DELETE FROM search_results`);
  await dst.query(`DELETE FROM searches`);
  await dst.query(`DELETE FROM all_tafsirs`);
  console.log("Cleared.\n");

  // Total
  const { rows: [{ total }] } = await src.query(
    `SELECT COUNT(*)::int AS total FROM mufassirai_tafsirdb.all_tafsirs`
  );
  console.log(`Migrating ${total} tafsirs (batched by ${BATCH})...\n`);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;
  const now = new Date();

  while (offset < total) {
    const { rows } = await src.query(
      `SELECT ROW_NUMBER() OVER () + $3 AS row_id, ayah_id, mufassir_id, commentary
       FROM mufassirai_tafsirdb.all_tafsirs
       ORDER BY ctid
       LIMIT $1 OFFSET $2`,
      [BATCH, offset, offset]
    );

    if (rows.length === 0) break;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;

    for (const t of rows) {
      const verseId = idMap.get(Number(t.ayah_id));
      if (!verseId) { skipped++; continue; }
      placeholders.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4})`);
      values.push(String(t.row_id), verseId, t.mufassir_id, t.commentary, now);
      p += 5;
    }

    if (placeholders.length > 0) {
      await dst.query(
        `INSERT INTO all_tafsirs (id, verse_id, mufassir_id, commentary, updated_at)
         VALUES ${placeholders.join(",")} ON CONFLICT (id) DO NOTHING`,
        values
      );
      inserted += placeholders.length;
    }

    offset += BATCH;
    process.stdout.write(`  ${inserted}/${total} (skipped: ${skipped})\r`);
  }

  console.log(`\n\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);

  // Verify
  const { rows: [{ count }] } = await dst.query(
    `SELECT COUNT(*)::int AS count FROM all_tafsirs`
  );
  const { rows: sures } = await dst.query(
    `SELECT COUNT(DISTINCT split_part(verse_id, '-', 1)) AS sure_count FROM all_tafsirs WHERE verse_id LIKE '%-%'`
  );
  console.log(`Railway all_tafsirs: ${count} kayıt, ${sures[0].sure_count} sure`);

  await src.end();
  await dst.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
