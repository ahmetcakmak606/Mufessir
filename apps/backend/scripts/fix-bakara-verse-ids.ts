#!/usr/bin/env tsx
/**
 * Fixes Bakara tafsir verse_id values in Railway.
 *
 * Root cause: During migration, OrbStack all_tafsirs.ayah_id used Bakara-sequential
 * numbering (1 = Bakara 2:1), but idMap was keyed by ayahs.id which includes 7 Fatiha
 * rows first. So Bakara tafsirs were stored 7 positions too low in verse_id:
 *   e.g. tafsir for 2:200 was stored at verse_id '2-193', tafsir for 2:207 at '2-200'
 *
 * Fix: shift all '2-k' verse_ids by +7.
 */

import pg from "pg";

const { Client } = pg;

const DST =
  "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

async function main() {
  const client = new Client({ connectionString: DST });
  await client.connect();
  console.log("Connected to Railway.\n");

  // Count Bakara rows currently
  const { rows: before } = await client.query(
    `SELECT COUNT(*)::int AS cnt, MIN(split_part(verse_id,'-',2)::int) AS min_v, MAX(split_part(verse_id,'-',2)::int) AS max_v
     FROM all_tafsirs WHERE verse_id ~ '^2-\\d+$'`,
  );
  console.log(
    `Before: ${before[0].cnt} Bakara rows, verse_id range 2-${before[0].min_v} to 2-${before[0].max_v}`,
  );

  // Delete rows that would shift beyond Bakara's 286 verses
  const { rowCount: deleted } = await client.query(
    `DELETE FROM all_tafsirs
     WHERE verse_id ~ '^2-\\d+$'
       AND split_part(verse_id,'-',2)::int + 7 > 286`,
  );
  console.log(`Deleted ${deleted} rows that would exceed verse 286.`);

  // Shift remaining Bakara verse_ids by +7
  const { rowCount: updated } = await client.query(
    `UPDATE all_tafsirs
     SET verse_id = '2-' || (split_part(verse_id,'-',2)::int + 7)::text
     WHERE verse_id ~ '^2-\\d+$'`,
  );
  console.log(`Updated ${updated} Bakara rows (+7 shift).`);

  // Verify
  const { rows: after } = await client.query(
    `SELECT COUNT(*)::int AS cnt, MIN(split_part(verse_id,'-',2)::int) AS min_v, MAX(split_part(verse_id,'-',2)::int) AS max_v
     FROM all_tafsirs WHERE verse_id ~ '^2-\\d+$'`,
  );
  console.log(
    `After: ${after[0].cnt} Bakara rows, verse_id range 2-${after[0].min_v} to 2-${after[0].max_v}`,
  );

  // Spot-check: show mufassir count for 2-200
  const { rows: spot } = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM all_tafsirs WHERE verse_id = '2-200'`,
  );
  console.log(`Spot-check verse_id '2-200': ${spot[0].cnt} tafsir(s)`);

  await client.end();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
