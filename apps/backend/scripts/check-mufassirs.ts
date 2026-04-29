#!/usr/bin/env tsx
import pg from "pg";
const { Client } = pg;
const DST = "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

async function main() {
  const c = new Client({ connectionString: DST });
  await c.connect();

  const { rows } = await c.query(
    `SELECT
       m.mufassir_id,
       m.mufassir_en,
       m.mufassir_tr,
       m.mufassir_ar,
       m.century,
       m.madhab,
       m.period,
       m.death_hijri,
       m.death_miladi,
       COUNT(t.id)::int AS tafsir_count,
       COUNT(DISTINCT split_part(t.verse_id, '-', 1))::int AS surah_count
     FROM mufassirs m
     LEFT JOIN all_tafsirs t ON t.mufassir_id = m.mufassir_id
     GROUP BY m.mufassir_id, m.mufassir_en, m.mufassir_tr, m.mufassir_ar, m.century, m.madhab, m.period, m.death_hijri, m.death_miladi
     ORDER BY tafsir_count DESC, m.mufassir_id ASC`,
  );

  console.log(`Total mufassirs: ${rows.length}\n`);
  console.log(
    "ID".padEnd(5),
    "EN Name".padEnd(35),
    "TR Name".padEnd(30),
    "Century".padEnd(9),
    "Madhab".padEnd(18),
    "Death(H)".padEnd(10),
    "Tafsirs".padEnd(10),
    "Surahs",
  );
  console.log("-".repeat(130));
  for (const r of rows) {
    console.log(
      String(r.mufassir_id).padEnd(5),
      (r.mufassir_en || "").padEnd(35),
      (r.mufassir_tr || "").padEnd(30),
      String(r.century || "").padEnd(9),
      (r.madhab || "").padEnd(18),
      String(r.death_hijri || "").padEnd(10),
      String(r.tafsir_count).padEnd(10),
      String(r.surah_count),
    );
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
