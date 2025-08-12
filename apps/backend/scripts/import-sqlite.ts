#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

type Row = Record<string, any>;

function asString(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH || resolve(__dirname, '../../../mufessir_ai_database.db');
  const db = new Database(sqlitePath, { readonly: true });

  console.log('Using SQLite at:', sqlitePath);

  // 1) Wipe existing Postgres data (in FK-safe order)
  console.log('Clearing existing data...');
  await prisma.searchResult.deleteMany();
  await prisma.search.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.tafsir.deleteMany();
  await prisma.scholar.deleteMany();
  await prisma.verse.deleteMany();

  // 2) Import scholars
  console.log('Importing scholars...');
  const scholarRows: Row[] = db.prepare('SELECT * FROM tafsir_scholars').all();
  for (const r of scholarRows) {
    const id = `scholar-${r.mufassirID}`;
    const deathYear = Number.isFinite(Number(r.death_miladi)) ? Number(r.death_miladi) : null;
    await prisma.scholar.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: asString(r.mufassir_tr) || asString(r.mufassir_en) || `Müfessir ${r.mufassirID}`,
        birthYear: null,
        deathYear,
        century: r.century ?? 0,
        madhab: asString(r.madhab),
        period: asString(r.period),
        environment: asString(r.environment),
        originCountry: asString(r.originCountry),
        reputationScore: r.reputationScore ?? null,
      },
    });
  }
  console.log(`Imported scholars: ${scholarRows.length}`);

  // 3) Import verses (ayahs + surah names)
  console.log('Importing verses...');
  const surahNameById = new Map<number, string>();
  const surahRows: Row[] = db.prepare('SELECT * FROM surahs').all();
  for (const s of surahRows) surahNameById.set(s.SurahID, asString(s.surah_name) || asString(s.surah_name_ar) || `Surah ${s.SurahID}`);

  const ayahRows: Row[] = db.prepare('SELECT * FROM ayahs').all();
  for (const a of ayahRows) {
    const id = `verse-${a.SuraID}-${a.VerseID}`;
    await prisma.verse.upsert({
      where: { id },
      update: {},
      create: {
        id,
        surahNumber: a.SuraID,
        surahName: surahNameById.get(a.SuraID) || `Surah ${a.SuraID}`,
        verseNumber: a.VerseID,
        arabicText: asString(a.AyahText_1) || '',
        transliteration: asString(a.AyahText_2),
        translation: null,
      },
    });
  }
  console.log(`Imported verses: ${ayahRows.length}`);

  // 4) Import tafsirs (optional, can be very large). Default: skip to keep import fast/cheap.
  if (process.env.IMPORT_TAFSIRS === 'true') {
    console.log('Importing tafsirs...');
    const tafsirRows: Row[] = db.prepare('SELECT * FROM tafsirs').all();
    let countTafsirs = 0;

    // Map bookID to text_content pieces (tafsir_books)
    const bookRows: Row[] = db.prepare('SELECT bookID, page_id, text_content FROM tafsir_books').all();
    const bookTextById = new Map<number, string>();
    for (const br of bookRows) {
      const existing = bookTextById.get(br.bookID) || '';
      bookTextById.set(br.bookID, existing + (asString(br.text_content) || '') + '\n');
    }

    for (const t of tafsirRows) {
      const tafsirId = `tafsir-${t.BookID}-${t.mufassirID}`;
      const scholarId = `scholar-${t.mufassirID}`;
      const verseId = `verse-1-1`; // temporary attachment if no mapping
      const tafsirText = asString(bookTextById.get(t.BookID)) || asString(t.Description) || '';

      await prisma.tafsir.upsert({
        where: { id: tafsirId },
        update: {},
        create: {
          id: tafsirId,
          verseId,
          scholarId,
          tafsirText,
          tafsirType: asString(t.tafsirType),
          keywords: asString(t.keywords) ? String(t.keywords).split(',').map((s) => s.trim()).filter(Boolean) : [],
          languageLevel: t.languageLevel ? Number(t.languageLevel) : null,
          emotionalRatio: t.emotionalRatio ? Number(t.emotionalRatio) : null,
        },
      });
      countTafsirs++;
    }
    console.log(`Imported tafsirs: ${countTafsirs}`);
  } else {
    console.log('Skipping tafsirs import (set IMPORT_TAFSIRS=true to include).');
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


