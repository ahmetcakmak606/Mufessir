#!/usr/bin/env tsx
function requireRailwayDatabaseUrl(): string {
  const url = process.env.RAILWAY_DATABASE_URL;
  if (!url) {
    throw new Error(
      'RAILWAY_DATABASE_URL is not set. This script no longer accepts an embedded connection string (2026-10-03, plan S.0.3).',
    );
  }
  return url;
}

import pg from "pg";

const { Client } = pg;
const DST =
  requireRailwayDatabaseUrl();

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
