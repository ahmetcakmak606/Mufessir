#!/usr/bin/env tsx
/**
 * Inserts sample tafsir records for Maide 5:35 into Railway.
 * Queries actual mufassir IDs from the DB before inserting.
 */

import pg from "pg";

const { Client } = pg;

const DST =
  "postgresql://postgres:YohCdZJubttuxsZkDtPrYyDPydDOyrrc@switchyard.proxy.rlwy.net:52129/railway";

const VERSE_ID = "5-35";

const TAFSIR_TEXTS: Record<string, { en: string; ar: string; text: string }> = {
  tabari: {
    en: "Al-Tabari",
    ar: "الطبري",
    text: `يَأْمُرُ اللَّهُ تَعَالَى الْمُؤْمِنِينَ بِتَقْوَاهُ وَخَشْيَتِهِ وَالتَّقَرُّبِ إِلَيْهِ بِفِعْلِ مَا أَمَرَ بِهِ وَتَرْكِ مَا نَهَى عَنْهُ، وَهُوَ مَعْنَى الْوَسِيلَةِ هَاهُنَا. قَالَ الزَّجَّاجُ: الْوَسِيلَةُ الَّتِي يُتَقَرَّبُ بِهَا إِلَى اللَّهِ عَزَّ وَجَلَّ. وَمَعْنَى ابْتَغُوا: اطْلُبُوا. وَقَوْلُهُ: {وَجَاهِدُوا فِي سَبِيلِهِ} أَيِ اجْعَلُوا جِهَادَكُمْ فِي طَاعَةِ اللَّهِ وَمَرْضَاتِهِ لَعَلَّكُمْ تُفْلِحُونَ أَيْ تَنْجَحُونَ وَتَظْفَرُونَ بِمَا تَأْمُلُونَ.`,
  },
  kathir: {
    en: "Ibn Kathir",
    ar: "ابن كثير",
    text: `يَقُولُ تَعَالَى آمِرًا عِبَادَهُ الْمُؤْمِنِينَ بِتَقْوَاهُ وَهِيَ الْعَمَلُ بِطَاعَتِهِ وَتَرْكُ مَعَاصِيهِ وَأَمَرَهُمْ بِالتَّوَصُّلِ إِلَيْهِ بِطَاعَتِهِ الَّتِي شَرَعَهَا عَلَى لِسَانِ رَسُولِهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ. وَالْوَسِيلَةُ هِيَ مَا يُتَقَرَّبُ بِهِ إِلَى الشَّيْءِ وَيُتَوَصَّلُ بِهِ إِلَيْهِ، وَالْمُرَادُ بِهَا هَاهُنَا: التَّقَرُّبُ إِلَى اللَّهِ تَعَالَى بِامْتِثَالِ أَوَامِرِهِ وَاجْتِنَابِ نَوَاهِيهِ وَالتَّمَسُّكِ بِشَرِيعَتِهِ.`,
  },
  qurtubi: {
    en: "Al-Qurtubi",
    ar: "القرطبي",
    text: `قَوْلُهُ تَعَالَى: {يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ} أَيِ اجْعَلُوا بَيْنَكُمْ وَبَيْنَ عَذَابِ اللَّهِ وِقَايَةً بِأَدَاءِ فَرَائِضِهِ وَاجْتِنَابِ مَحَارِمِهِ. {وَابْتَغُوا إِلَيْهِ الْوَسِيلَةَ} أَيِ الْقُرْبَةَ إِلَيْهِ سُبْحَانَهُ بِالْأَعْمَالِ الصَّالِحَةِ. {وَجَاهِدُوا فِي سَبِيلِهِ} أَيْ قَاتِلُوا أَعْدَاءَهُ، وَقِيلَ: جَاهِدُوا أَنْفُسَكُمْ فِي طَاعَتِهِ. {لَعَلَّكُمْ تُفْلِحُونَ} أَيْ كَيْ تَفُوزُوا بِالنَّجَاةِ مِنَ النَّارِ وَدُخُولِ الْجَنَّةِ.`,
  },
};

async function main() {
  const client = new Client({ connectionString: DST });
  await client.connect();
  console.log("Connected to Railway.\n");

  // Verify verse exists
  const { rows: verseRows } = await client.query(
    `SELECT id, ayah_number FROM ayahs WHERE id = $1`,
    [VERSE_ID],
  );
  if (verseRows.length === 0) {
    console.error(`Verse '${VERSE_ID}' not found in ayahs table! Check seed data.`);
    await client.end();
    process.exit(1);
  }
  console.log(`Verse '${VERSE_ID}' found: ayah_number=${verseRows[0].ayah_number}`);

  // Find mufassir IDs
  const { rows: mufassirs } = await client.query(
    `SELECT mufassir_id, mufassir_en, mufassir_ar
     FROM mufassirs
     WHERE mufassir_en ILIKE '%tabari%'
        OR mufassir_en ILIKE '%kathir%'
        OR mufassir_en ILIKE '%qurtubi%'
        OR mufassir_ar ILIKE '%طبري%'
        OR mufassir_ar ILIKE '%كثير%'
        OR mufassir_ar ILIKE '%قرطبي%'
     ORDER BY mufassir_id`,
  );

  console.log(`\nFound ${mufassirs.length} matching mufassir(s):`);
  for (const m of mufassirs) {
    console.log(`  id=${m.mufassir_id}  en="${m.mufassir_en}"  ar="${m.mufassir_ar}"`);
  }

  if (mufassirs.length === 0) {
    console.error("No matching mufassirs found. Cannot insert tafsirs.");
    await client.end();
    process.exit(1);
  }

  // Check existing tafsirs for this verse
  const { rows: existing } = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM all_tafsirs WHERE verse_id = $1`,
    [VERSE_ID],
  );
  console.log(`\nExisting tafsirs for '${VERSE_ID}': ${existing[0].cnt}`);

  // Insert for each found mufassir
  let inserted = 0;
  for (const m of mufassirs) {
    const nameEn = (m.mufassir_en || "").toLowerCase();
    const nameAr = (m.mufassir_ar || "").toLowerCase();

    let text: string | null = null;
    if (nameEn.includes("tabari") || nameAr.includes("طبري")) {
      text = TAFSIR_TEXTS.tabari.text;
    } else if (nameEn.includes("kathir") || nameAr.includes("كثير")) {
      text = TAFSIR_TEXTS.kathir.text;
    } else if (nameEn.includes("qurtubi") || nameAr.includes("قرطبي")) {
      text = TAFSIR_TEXTS.qurtubi.text;
    }

    if (!text) {
      console.log(`  Skipping mufassir_id=${m.mufassir_id} (no text prepared)`);
      continue;
    }

    const { rows: maxId } = await client.query(
      `SELECT COALESCE(MAX(id::bigint), 0) + 1 AS next_id FROM all_tafsirs`,
    );
    await client.query(
      `INSERT INTO all_tafsirs (id, verse_id, mufassir_id, commentary, updated_at)
       VALUES ($4, $1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [VERSE_ID, m.mufassir_id, text, maxId[0].next_id],
    );
    inserted++;
    console.log(`  Inserted tafsir for mufassir_id=${m.mufassir_id} (${m.mufassir_en})`);
  }

  console.log(`\nInserted ${inserted} tafsir(s) for '${VERSE_ID}'.`);

  // Verify
  const { rows: final } = await client.query(
    `SELECT at.mufassir_id, m.mufassir_en, LEFT(at.commentary, 80) AS preview
     FROM all_tafsirs at
     JOIN mufassirs m ON m.mufassir_id = at.mufassir_id
     WHERE at.verse_id = $1`,
    [VERSE_ID],
  );
  console.log(`\nFinal tafsirs for '${VERSE_ID}':`);
  for (const r of final) {
    console.log(`  [${r.mufassir_id}] ${r.mufassir_en}: ${r.preview}...`);
  }

  await client.end();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
