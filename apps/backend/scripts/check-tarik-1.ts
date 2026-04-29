#!/usr/bin/env tsx
import pg from "pg";

const { Client } = pg;
const DST =
  "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

async function main() {
  const c = new Client({ connectionString: DST });
  await c.connect();

  // Distinct surahs with tafsirs
  const { rows: suras } = await c.query(
    `SELECT split_part(verse_id, '-', 1)::int AS surah, COUNT(*)::int AS tafsir_count
     FROM all_tafsirs
     WHERE verse_id ~ '^\\d+-\\d+$'
     GROUP BY 1
     ORDER BY 1`,
  );
  console.log("Surahs with tafsirs:");
  for (const r of suras) {
    console.log(`  Surah ${r.surah}: ${r.tafsir_count} tafsirs`);
  }

  // Total
  const { rows: total } = await c.query(
    `SELECT COUNT(*)::int AS cnt FROM all_tafsirs`,
  );
  console.log(`\nTotal tafsirs: ${total[0].cnt}`);

  // Tarik 86:1 check
  const { rows: tarik } = await c.query(
    `SELECT COUNT(*)::int AS cnt FROM all_tafsirs WHERE verse_id = '86-1'`,
  );
  console.log(`Tarık 86:1 tafsirs: ${tarik[0].cnt}`);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
