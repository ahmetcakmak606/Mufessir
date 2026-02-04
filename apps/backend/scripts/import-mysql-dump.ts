#!/usr/bin/env tsx
import fs from 'fs';
import { resolve, dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

type Field = { value: string; quoted: boolean };

type AyahRow = {
  surahId: number;
  ayahNumber: number;
  arabicText: string;
  transliteration: string | null;
};

type SurahInfo = {
  surahNumber: number;
  nameTr: string | null;
  nameAr: string | null;
  nameEn: string | null;
};

type MufassirInfo = {
  nameTr: string | null;
  nameEn: string | null;
  nameAr: string | null;
  nameLong: string | null;
  deathMiladi: number | null;
  century: number | null;
  madhab: string | null;
  period: string | null;
  environment: string | null;
  originCountry: string | null;
  reputationScore: number | null;
  tafsirType1: string | null;
};

type MufassirFallback = {
  nameAr: string | null;
  nameLabel: string | null;
};

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const SQL_PATH =
  process.env.SQL_DUMP_PATH ||
  resolve(__dirname, '../../../MufessirAI_backup_20251130_121211.sql');

const BATCH_VERSES = Number(process.env.BATCH_VERSES || 500);
const BATCH_TAFSIRS = Number(process.env.BATCH_TAFSIRS || 50);

const ayahRows: AyahRow[] = [];
const surahById = new Map<number, SurahInfo>();
const mufassirById = new Map<number, MufassirInfo>();
const mufassirFallbackById = new Map<number, MufassirFallback>();

const mufassirTypeById = new Map<number, string>();

let versesReady = false;
let scholarsReady = false;

const verseBatch: Array<{
  id: string;
  surahNumber: number;
  surahName: string;
  verseNumber: number;
  arabicText: string;
  transliteration: string | null;
  translation: string | null;
}> = [];

const tafsirBatch: Array<{
  id: string;
  verseId: string;
  scholarId: string;
  tafsirText: string;
  tafsirType: string | null;
  keywords: string[];
  languageLevel: number | null;
  emotionalRatio: number | null;
}> = [];

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length ? s : null;
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toValue(field: Field): string | number | null {
  if (field.quoted) return field.value;
  const trimmed = field.value.trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function decodeEscapeChar(ch: string): string {
  switch (ch) {
    case '0':
      return '\0';
    case 'b':
      return '\b';
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case 'Z':
      return '\x1a';
    case "'":
      return "'";
    case '"':
      return '"';
    case '\\':
      return '\\';
    default:
      return ch;
  }
}

async function clearDb() {
  if (process.env.RESET_DB !== 'true') {
    throw new Error('RESET_DB=true is required to clear existing data.');
  }
  await prisma.searchResult.deleteMany();
  await prisma.search.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.tafsir.deleteMany();
  await prisma.scholar.deleteMany();
  await prisma.verse.deleteMany();
}

async function flushVerses() {
  if (!verseBatch.length) return;
  await prisma.verse.createMany({ data: verseBatch, skipDuplicates: true });
  verseBatch.length = 0;
}

async function flushTafsirs() {
  if (!tafsirBatch.length) return;
  await prisma.tafsir.createMany({ data: tafsirBatch, skipDuplicates: true });
  tafsirBatch.length = 0;
}

async function buildVerses() {
  for (const a of ayahRows) {
    const surahInfo = surahById.get(a.surahId);
    const surahNumber = surahInfo?.surahNumber ?? a.surahId;
    const surahName =
      surahInfo?.nameTr ||
      surahInfo?.nameEn ||
      surahInfo?.nameAr ||
      `Surah ${surahNumber}`;
    verseBatch.push({
      id: `verse-${surahNumber}-${a.ayahNumber}`,
      surahNumber,
      surahName,
      verseNumber: a.ayahNumber,
      arabicText: a.arabicText || '',
      transliteration: a.transliteration,
      translation: null,
    });
    if (verseBatch.length >= BATCH_VERSES) {
      await flushVerses();
    }
  }

  for (const [surahId, surahInfo] of surahById) {
    const surahNumber = surahInfo.surahNumber ?? surahId;
    const surahName =
      surahInfo.nameTr ||
      surahInfo.nameEn ||
      surahInfo.nameAr ||
      `Surah ${surahNumber}`;
    verseBatch.push({
      id: `verse-${surahNumber}-0`,
      surahNumber,
      surahName,
      verseNumber: 0,
      arabicText: surahInfo.nameAr || '',
      transliteration: null,
      translation: null,
    });
    if (verseBatch.length >= BATCH_VERSES) {
      await flushVerses();
    }
  }

  await flushVerses();
  versesReady = true;
}

async function buildScholars() {
  const ids = new Set<number>();
  for (const id of mufassirById.keys()) ids.add(id);
  for (const id of mufassirFallbackById.keys()) ids.add(id);

  const batch: Array<{
    id: string;
    name: string;
    birthYear: number | null;
    deathYear: number | null;
    century: number;
    madhab: string | null;
    period: string | null;
    environment: string | null;
    originCountry: string | null;
    reputationScore: number | null;
  }> = [];

  for (const id of ids) {
    const m = mufassirById.get(id);
    const fallback = mufassirFallbackById.get(id);
    const name =
      m?.nameTr ||
      m?.nameEn ||
      m?.nameAr ||
      m?.nameLong ||
      fallback?.nameAr ||
      fallback?.nameLabel ||
      `Mufassir ${id}`;

    if (m?.tafsirType1) {
      mufassirTypeById.set(id, m.tafsirType1);
    }

    batch.push({
      id: `scholar-${id}`,
      name,
      birthYear: null,
      deathYear: m?.deathMiladi ?? null,
      century: m?.century ?? 0,
      madhab: m?.madhab ?? null,
      period: m?.period ?? null,
      environment: m?.environment ?? null,
      originCountry: m?.originCountry ?? null,
      reputationScore: m?.reputationScore ?? null,
    });
  }

  if (batch.length) {
    await prisma.scholar.createMany({ data: batch, skipDuplicates: true });
  }

  scholarsReady = true;
}

function isTableOfInterest(table: string): boolean {
  if (table === 'surahs') return true;
  if (table === 'ayahs') return true;
  if (table === 'mufassirs') return true;
  if (table === 'Mufessirs_dead_hijri') return true;
  if (table.startsWith('tafseer_')) return true;
  return false;
}

class ValuesParser {
  private inString = false;
  private escapeNext = false;
  private depth = 0;
  private field = '';
  private fieldQuoted = false;
  private row: Field[] = [];
  private currentTable = '';
  private active = false;
  private parseRows = false;

  reset(table: string, parseRows: boolean) {
    this.inString = false;
    this.escapeNext = false;
    this.depth = 0;
    this.field = '';
    this.fieldQuoted = false;
    this.row = [];
    this.currentTable = table;
    this.active = true;
    this.parseRows = parseRows;
  }

  async parseChunk(chunk: string, startIndex = 0): Promise<{ index: number; done: boolean }> {
    let i = startIndex;
    for (; i < chunk.length; i++) {
      const c = chunk[i];

      if (this.inString) {
        if (this.escapeNext) {
          this.field += decodeEscapeChar(c);
          this.escapeNext = false;
          continue;
        }
        if (c === '\\') {
          this.escapeNext = true;
          continue;
        }
        if (c === "'") {
          this.inString = false;
          continue;
        }
        this.field += c;
        continue;
      }

      if (c === "'") {
        this.inString = true;
        this.fieldQuoted = true;
        continue;
      }

      if (c === '(') {
        if (this.depth === 0) {
          this.depth = 1;
          this.row = [];
          this.field = '';
          this.fieldQuoted = false;
          continue;
        }
        this.depth++;
        if (this.parseRows) this.field += c;
        continue;
      }

      if (c === ')') {
        if (this.depth === 1) {
          if (this.parseRows) {
            this.row.push({ value: this.field, quoted: this.fieldQuoted });
            await handleRow(this.currentTable, this.row);
          }
          this.depth = 0;
          this.field = '';
          this.fieldQuoted = false;
          this.row = [];
          continue;
        }
        this.depth = Math.max(0, this.depth - 1);
        if (this.parseRows) this.field += c;
        continue;
      }

      if (c === ',' && this.depth === 1 && this.parseRows) {
        this.row.push({ value: this.field, quoted: this.fieldQuoted });
        this.field = '';
        this.fieldQuoted = false;
        continue;
      }

      if (c === ';' && this.depth === 0) {
        this.active = false;
        return { index: i + 1, done: true };
      }

      if (this.parseRows && this.depth >= 1) {
        this.field += c;
      }
    }

    return { index: i, done: false };
  }
}

const valuesParser = new ValuesParser();

async function handleRow(table: string, row: Field[]) {
  if (table === 'surahs') {
    const id = toValue(row[0]);
    const surahNumber = toValue(row[1]);
    const nameAr = toValue(row[2]);
    const nameTr = toValue(row[3]);
    const nameEn = toValue(row[4]);
    if (typeof id === 'number') {
      surahById.set(id, {
        surahNumber: typeof surahNumber === 'number' ? surahNumber : id,
        nameAr: asString(nameAr),
        nameTr: asString(nameTr),
        nameEn: asString(nameEn),
      });
    }
    return;
  }

  if (table === 'ayahs') {
    const surahId = toValue(row[1]);
    const ayahNumber = toValue(row[2]);
    const arabicText = toValue(row[3]);
    const transliteration = toValue(row[6]);
    if (typeof surahId === 'number' && typeof ayahNumber === 'number') {
      ayahRows.push({
        surahId,
        ayahNumber,
        arabicText: asString(arabicText) || '',
        transliteration: asString(transliteration),
      });
    }
    return;
  }

  if (table === 'mufassirs') {
    const mufassirId = toValue(row[1]);
    if (typeof mufassirId !== 'number') return;

    mufassirById.set(mufassirId, {
      nameTr: asString(toValue(row[3])),
      nameEn: asString(toValue(row[2])),
      nameAr: asString(toValue(row[4])),
      nameLong: asString(toValue(row[5])),
      deathMiladi: asNumber(toValue(row[10])),
      century: asNumber(toValue(row[11])),
      madhab: asString(toValue(row[13])),
      period: asString(toValue(row[12])),
      environment: asString(toValue(row[14])),
      originCountry: asString(toValue(row[15])),
      reputationScore: asNumber(toValue(row[16])),
      tafsirType1: asString(toValue(row[21])),
    });
    return;
  }

  if (table === 'Mufessirs_dead_hijri') {
    const mufassirId = toValue(row[1]);
    if (typeof mufassirId !== 'number') return;

    mufassirFallbackById.set(mufassirId, {
      nameLabel: asString(toValue(row[0])),
      nameAr: asString(toValue(row[2])),
    });
    return;
  }

  if (table.startsWith('tafseer_')) {
    if (!versesReady || !scholarsReady) {
      throw new Error('Verses/scholars are not ready before tafseer import.');
    }
    const tafseerId = toValue(row[0]);
    const surahId = toValue(row[1]);
    const ayahId = toValue(row[2]);
    const mufassirId = toValue(row[3]);
    const commentary = toValue(row[4]);

    if (
      typeof tafseerId !== 'number' ||
      typeof surahId !== 'number' ||
      typeof ayahId !== 'number' ||
      typeof mufassirId !== 'number'
    ) {
      return;
    }

    const surahInfo = surahById.get(surahId);
    const surahNumber = surahInfo?.surahNumber ?? surahId;
    const verseNumber = ayahId >= 10000 ? 0 : ayahId;
    const verseId = `verse-${surahNumber}-${verseNumber}`;
    const scholarId = `scholar-${mufassirId}`;
    const tafsirType = mufassirTypeById.get(mufassirId) || null;

    tafsirBatch.push({
      id: `tafsir-${surahId}-${tafseerId}`,
      verseId,
      scholarId,
      tafsirText: asString(commentary) || '',
      tafsirType,
      keywords: [],
      languageLevel: null,
      emotionalRatio: null,
    });

    if (tafsirBatch.length >= BATCH_TAFSIRS) {
      await flushTafsirs();
    }
    return;
  }
}

async function parseDump() {
  await clearDb();

  const stream = fs.createReadStream(SQL_PATH, { encoding: 'utf8' });
  let buffer = '';
  let state: 'search' | 'findValues' | 'parseValues' = 'search';
  let currentTable = '';

  for await (const chunk of stream) {
    buffer += chunk;
    let idx = 0;
    let bufferAdjusted = false;

    while (idx < buffer.length) {
      if (state === 'search') {
        const startIdx = buffer.indexOf('INSERT INTO `', idx);
        if (startIdx === -1) {
          buffer = buffer.slice(Math.max(0, buffer.length - 20));
          bufferAdjusted = true;
          break;
        }
        idx = startIdx + 'INSERT INTO `'.length;
        const endIdx = buffer.indexOf('`', idx);
        if (endIdx === -1) {
          buffer = buffer.slice(startIdx);
          break;
        }
        currentTable = buffer.slice(idx, endIdx);
        idx = endIdx + 1;
        state = 'findValues';
      }

      if (state === 'findValues') {
        const valuesIdx = buffer.indexOf('VALUES', idx);
        if (valuesIdx === -1) {
          buffer = buffer.slice(Math.max(0, buffer.length - 20));
          bufferAdjusted = true;
          break;
        }
        idx = valuesIdx + 'VALUES'.length;
        const parseRows = isTableOfInterest(currentTable);
        valuesParser.reset(currentTable, parseRows);
        state = 'parseValues';
      }

      if (state === 'parseValues') {
        const { index: nextIdx, done } = await valuesParser.parseChunk(buffer, idx);
        idx = nextIdx;
        if (done) {
          if (currentTable === 'surahs') {
            await buildVerses();
            await buildScholars();
          }
          if (currentTable.startsWith('tafseer_')) {
            await flushTafsirs();
          }
          state = 'search';
          currentTable = '';
        }
      }
    }

    if (!bufferAdjusted) {
      if (idx >= buffer.length) {
        buffer = '';
      } else if (idx > 0) {
        buffer = buffer.slice(idx);
      }
    }
  }

  await flushTafsirs();
}

async function main() {
  console.log('Using SQL dump:', SQL_PATH);
  await parseDump();
  console.log('Import complete.');
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
