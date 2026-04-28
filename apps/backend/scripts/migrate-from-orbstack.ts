#!/usr/bin/env tsx
/**
 * Migrates data from original OrbStack DB (pg-rescue container, port 5433)
 * to the target mufessir DB (mufessir-db container, port 5432).
 *
 * Source schema: mufassirai_tafsirdb
 *   - surahs: id(int), surah_number, surah_name_ar/tr/en, total_ayahs, revelation_type, revelation_order
 *   - ayahs:  id(int), surah_id, ayah_number, ayah_text_ar, ayah_text_tr, transliteration, ...
 *   - mufassirs: mufassir_id, mufassir_en/tr/ar, century, madhab, reputation_score, ...
 *   - all_tafsirs: tafseer_id(int), surah_id, ayah_id, mufassir_id, commentary, ...
 *
 * Target schema: public (Prisma)
 *   - surahs: id(int), surah_number, surah_name_ar/tr/en, total_ayahs, revelation_type, revelation_order
 *   - ayahs:  id(text = original int as string), surah_id, ayah_number, ayah_text_ar, ...
 *   - mufassirs: same columns
 *   - all_tafsirs: id(text = tafseer_id as string), verse_id(text = ayah_id as string), mufassir_id, commentary, "updatedAt"
 */

import pg from "pg";

const { Client } = pg;

const SRC = "postgresql://postgres:postgres@localhost:5433/MufassirAI_TafsirDB";
const DST = "postgresql://postgres:postgres@localhost:5432/mufessir";
const BATCH = 2000;

async function main() {
  const src = new Client({ connectionString: SRC });
  const dst = new Client({ connectionString: DST });

  await src.connect();
  await dst.connect();

  console.log("Connected to both databases.\n");

  // Clear target in FK-safe order
  console.log("Clearing target tables...");
  await dst.query(`DELETE FROM all_tafsirs`);
  await dst.query(`DELETE FROM "searches"`);
  await dst.query(`DELETE FROM "search_results"`);
  await dst.query(`DELETE FROM "favorites"`);
  await dst.query(`DELETE FROM ayahs`);
  await dst.query(`DELETE FROM mufassirs`);
  await dst.query(`DELETE FROM surahs`);
  console.log("Cleared.\n");

  // 1) Surahs
  console.log("Migrating surahs...");
  const { rows: surahs } = await src.query(
    `SELECT id, surah_number, surah_name_ar, surah_name_tr, surah_name_en,
            total_ayahs, revelation_type::text, revelation_order
     FROM mufassirai_tafsirdb.surahs`
  );
  for (const s of surahs) {
    await dst.query(
      `INSERT INTO surahs (id, surah_number, surah_name_ar, surah_name_tr, surah_name_en,
                           total_ayahs, revelation_type, revelation_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [s.id, s.surah_number, s.surah_name_ar, s.surah_name_tr, s.surah_name_en,
       s.total_ayahs, s.revelation_type, s.revelation_order]
    );
  }
  console.log(`  ${surahs.length} surahs done.\n`);

  // 2) Ayahs — id stored as text (original integer)
  console.log("Migrating ayahs...");
  const { rows: ayahs } = await src.query(
    `SELECT id, surah_id, ayah_number, ayah_text_ar, ayah_text_tr, transliteration
     FROM mufassirai_tafsirdb.ayahs`
  );
  let ayahCount = 0;
  for (const a of ayahs) {
    await dst.query(
      `INSERT INTO ayahs (id, surah_id, ayah_number, ayah_text_ar, ayah_text_tr, transliteration)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [String(a.id), a.surah_id, a.ayah_number, a.ayah_text_ar, a.ayah_text_tr, a.transliteration]
    );
    ayahCount++;
  }
  console.log(`  ${ayahCount} ayahs done.\n`);

  // 3) Mufassirs
  console.log("Migrating mufassirs...");
  const { rows: mufassirs } = await src.query(
    `SELECT mufassir_id, mufassir_en, mufassir_tr, mufassir_ar, mufassir_name_long,
            mufassirs_tafsir, mufassirs_tafsir_ar, book_id, death_hijri, death_miladi,
            century, period, madhab, environment, origin_country, reputation_score,
            explanation, detail_information, tafsir_type1, tafsir_type2
     FROM mufassirai_tafsirdb.mufassirs`
  );
  for (const m of mufassirs) {
    await dst.query(
      `INSERT INTO mufassirs (mufassir_id, mufassir_en, mufassir_tr, mufassir_ar, mufassir_name_long,
                              mufassirs_tafsir, mufassirs_tafsir_ar, book_id, death_hijri, death_miladi,
                              century, period, madhab, environment, origin_country, reputation_score,
                              explanation, "detailInformation", tafsir_type1, tafsir_type2)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (mufassir_id) DO NOTHING`,
      [m.mufassir_id, m.mufassir_en, m.mufassir_tr, m.mufassir_ar, m.mufassir_name_long,
       m.mufassirs_tafsir, m.mufassirs_tafsir_ar, m.book_id, m.death_hijri, m.death_miladi,
       m.century, m.period, m.madhab, m.environment, m.origin_country, m.reputation_score,
       m.explanation, m.detail_information, m.tafsir_type1, m.tafsir_type2]
    );
  }
  console.log(`  ${mufassirs.length} mufassirs done.\n`);

  // 4) All tafsirs — batched
  console.log("Migrating all_tafsirs (batched)...");
  const { rows: [{ total }] } = await src.query(
    `SELECT COUNT(*)::int AS total FROM mufassirai_tafsirdb.all_tafsirs`
  );
  console.log(`  Total: ${total}`);

  let offset = 0;
  let inserted = 0;
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

    // Bulk insert via VALUES
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const t of rows) {
      placeholders.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4})`);
      values.push(String(t.row_id), String(t.ayah_id), t.mufassir_id, t.commentary, now);
      p += 5;
    }

    await dst.query(
      `INSERT INTO all_tafsirs (id, verse_id, mufassir_id, commentary, "updatedAt")
       VALUES ${placeholders.join(",")} ON CONFLICT (id) DO NOTHING`,
      values
    );

    inserted += rows.length;
    offset += BATCH;
    process.stdout.write(`  ${inserted}/${total}\r`);
  }

  console.log(`\n  ${inserted} tafsirs done.\n`);

  await src.end();
  await dst.end();
  console.log("Migration complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
