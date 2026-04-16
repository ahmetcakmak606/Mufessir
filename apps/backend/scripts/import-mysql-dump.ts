#!/usr/bin/env tsx
import fs from "fs";
import { resolve, dirname } from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../.env") });

const SQL_PATH = resolve(
  __dirname,
  "../../../docs/MufassirAI_TafsirDB_Backup.sql",
);

interface SurahInfo {
  id: number;
  surahNumber: number;
  nameAr: string | null;
  nameTr: string | null;
  nameEn: string | null;
  totalAyahs: number;
  revelationType: string | null;
}

interface VerseInfo {
  id: string;
  surahNumber: number;
  verseNumber: number;
  arabicText: string;
  transliteration: string | null;
  translation: string | null;
}

interface MufassirInfo {
  id: number;
  nameTr: string | null;
  nameEn: string | null;
  nameAr: string | null;
  nameLong: string | null;
  deathHijri: number | null;
  deathMiladi: number | null;
  century: number | null;
  madhab: string | null;
  period: string | null;
  environment: string | null;
  originCountry: string | null;
  reputationScore: number | null;
  tafsirType1: string | null;
  tafsirType2: string | null;
}

interface TafsirInfo {
  id: string;
  verseId: string;
  mufassirId: number;
  tafsirText: string;
}

const surahs = new Map<number, SurahInfo>();
const verses = new Map<string, VerseInfo>();
const mufassirs = new Map<number, MufassirInfo>();
const tafsirs: TafsirInfo[] = [];

function decodeEscape(ch: string): string {
  if (ch === "0") return "\0";
  if (ch === "b") return "\b";
  if (ch === "n") return "\n";
  if (ch === "r") return "\r";
  if (ch === "t") return "\t";
  if (ch === "Z") return "\x1a";
  if (ch === "'") return "'";
  if (ch === '"') return '"';
  if (ch === "\\") return "\\";
  return ch;
}

function parseValue(val: string, quoted: boolean): string | number | null {
  if (quoted) return val;
  const t = val.trim();
  if (!t || t === "NULL") return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function processRow(table: string, row: (string | number | null)[]) {
  if (table === "surahs" && row.length >= 7) {
    const id = row[0] as number;
    const sn = row[1] as number;
    surahs.set(id, {
      id,
      surahNumber: sn,
      nameAr: row[2] as string | null,
      nameTr: row[3] as string | null,
      nameEn: row[4] as string | null,
      totalAyahs: (row[5] as number) || 0,
      revelationType: row[6] as string | null,
    });
  }

  if (table === "ayahs" && row.length >= 7) {
    const sid = row[1] as number;
    const an = row[2] as number;
    const s = surahs.get(sid);
    const sn = s?.surahNumber ?? sid;
    const vid = "verse-" + sn + "-" + an;
    verses.set(vid, {
      id: vid,
      surahNumber: sn,
      verseNumber: an,
      arabicText: (row[3] as string) || "",
      transliteration: row[6] as string | null,
      translation: row[4] as string | null,
    });
  }

  if (table === "mufassirs" && row.length >= 23) {
    const id = row[1] as number;
    mufassirs.set(id, {
      id,
      nameTr: row[3] as string | null,
      nameEn: row[2] as string | null,
      nameAr: row[4] as string | null,
      nameLong: row[5] as string | null,
      deathHijri: row[9] as number | null,
      deathMiladi: row[10] as number | null,
      century: row[11] as number | null,
      period: row[12] as string | null,
      madhab: row[13] as string | null,
      environment: row[14] as string | null,
      originCountry: row[15] as string | null,
      reputationScore: row[16] as number | null,
      tafsirType1: row[21] as string | null,
      tafsirType2: row[22] as string | null,
    });
  }

  if (table === "all_tafsirs" && row.length >= 5) {
    const tid = row[0] as number;
    const sid = row[1] as number;
    const aid = row[2] as number;
    const mid = row[3] as number;
    const comm = row[4] as string;
    const s = surahs.get(sid);
    const sn = s?.surahNumber ?? sid;
    const vn = aid >= 10000 ? 0 : aid;
    const vid = "verse-" + sn + "-" + vn;
    if (vid && mid) {
      tafsirs.push({
        id: "tafsir-" + sid + "-" + aid + "-" + mid,
        verseId: vid,
        mufassirId: mid,
        tafsirText: comm || "",
      });
    }
  }
}

async function run() {
  console.log("Processing SQL file in chunks...");

  let buffer = "";
  let state: "search" | "values" = "search";
  let table = "";
  let inStr = false;
  let esc = false;
  let depth = 0;
  let field = "";
  let fieldQ = false;
  let row: (string | number | null)[] = [];

  const stream = fs.createReadStream(SQL_PATH, {
    encoding: "utf8",
    highWaterMark: 1024 * 1024,
  });

  for await (const chunk of stream) {
    buffer += chunk;
    let i = 0;

    while (i < buffer.length) {
      const c = buffer[i];

      if (state === "search") {
        const insertPos = buffer.indexOf("INSERT INTO `", i);
        if (insertPos !== -1) {
          const start = insertPos + 12;
          const end = buffer.indexOf("`", start);
          if (end > start && end - start < 50) {
            table = buffer.slice(start, end);
            const valuesPos = buffer.indexOf("VALUES", end);
            if (valuesPos !== -1) {
              i = valuesPos + 6;
              state = "values";
              inStr = false;
              esc = false;
              depth = 0;
              console.log("Parsing: " + table);
              continue;
            }
          }
        }
        i = buffer.length - 10;
        continue;
      }

      // parsing VALUES
      if (inStr) {
        if (esc) {
          buffer = buffer.slice(0, i) + decodeEscape(c) + buffer.slice(i + 1);
          esc = false;
        } else if (c === "\\") {
          esc = true;
        } else if (c === "'") {
          inStr = false;
        }
        i++;
        continue;
      }

      if (c === "'") {
        inStr = true;
        fieldQ = true;
        i++;
        continue;
      }

      if (c === "(") {
        if (depth === 0) {
          depth = 1;
          row = [];
          field = "";
          fieldQ = false;
          i++;
          continue;
        }
        depth++;
      } else if (c === ")") {
        if (depth === 1) {
          row.push(parseValue(field, fieldQ));
          processRow(table, row);
          depth = 0;
          field = "";
          fieldQ = false;
          row = [];
          i++;
          continue;
        }
        depth = Math.max(0, depth - 1);
      } else if (c === "," && depth === 1) {
        row.push(parseValue(field, fieldQ));
        field = "";
        fieldQ = false;
      } else if (c === ";" && depth === 0) {
        state = "search";
        table = "";
      }

      if (depth >= 1) field += c;
      i++;
    }

    // Keep last 1000 chars for partial state
    if (buffer.length > 1000) {
      buffer = buffer.slice(-1000);
    }
  }

  console.log(
    "Found: " +
      surahs.size +
      " surahs, " +
      verses.size +
      " verses, " +
      mufassirs.size +
      " mufassirs, " +
      tafsirs.length +
      " tafsirs",
  );

  console.log("Clearing DB...");
  await prisma.searchResult.deleteMany();
  await prisma.search.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.tafsir.deleteMany();
  await prisma.mufassir.deleteMany();
  await prisma.verse.deleteMany();
  await prisma.surah.deleteMany();

  console.log("Inserting surahs...");
  for (const s of surahs.values()) {
    await prisma.surah.upsert({ where: { id: s.id }, update: {}, create: s });
  }

  console.log("Inserting verses...");
  for (const v of verses.values()) {
    await prisma.verse.upsert({ where: { id: v.id }, update: {}, create: v });
  }

  console.log("Inserting mufassirs...");
  for (const m of mufassirs.values()) {
    await prisma.mufassir.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        nameEn: m.nameEn,
        nameTr: m.nameTr,
        nameAr: m.nameAr,
        nameLong: m.nameLong,
        deathHijri: m.deathHijri,
        deathMiladi: m.deathMiladi,
        century: m.century || 0,
        period: m.period,
        madhab: m.madhab,
        environment: m.environment,
        originCountry: m.originCountry,
        reputationScore: m.reputationScore,
        tafsirType1: m.tafsirType1,
        tafsirType2: m.tafsirType2,
      },
    });
  }

  console.log("Inserting tafsirs...");
  const bs = 100;
  for (let i = 0; i < tafsirs.length; i += bs) {
    const b = tafsirs.slice(i, i + bs);
    await prisma.tafsir.createMany({ data: b, skipDuplicates: true });
    if (Math.floor(i / bs) % 10 === 0)
      console.log("  " + (i + b.length) + "/" + tafsirs.length);
  }

  console.log("Done!");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
