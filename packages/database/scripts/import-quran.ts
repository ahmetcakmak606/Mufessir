#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

type VerseEntry = { surah: number; ayah: number; text: string };

function readJson<T>(p: string): T {
  if (!existsSync(p)) throw new Error(`File not found: ${p}`);
  const raw = readFileSync(p, 'utf8');
  return JSON.parse(raw) as T;
}

function arg(flag: string, def?: string) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

async function main() {
  const prisma = new PrismaClient();
  const arPath = resolve(process.cwd(), arg('--ar', 'packages/database/data/quran-ar.json')!);
  const trPath = resolve(process.cwd(), arg('--tr', 'packages/database/data/quran-tr-diyanet.json')!);

  console.log('Reading Arabic from', arPath);
  const ar = readJson<VerseEntry[]>(arPath);

  console.log('Reading Turkish (Diyanet) from', trPath);
  const tr = readJson<VerseEntry[]>(trPath);

  const trMap = new Map<string, string>();
  for (const v of tr) trMap.set(`${v.surah}:${v.ayah}`, v.text);

  let count = 0;
  for (const v of ar) {
    const key = `${v.surah}:${v.ayah}`;
    const translation = trMap.get(key) || null;
    await prisma.verse.upsert({
      where: { surahNumber_verseNumber: { surahNumber: v.surah, verseNumber: v.ayah } },
      update: { arabicText: v.text, translation: translation ?? undefined },
      create: {
        surahNumber: v.surah,
        verseNumber: v.ayah,
        surahName: `Surah ${v.surah}`,
        arabicText: v.text,
        translation: translation ?? undefined,
      },
    });
    count++;
    if (count % 1000 === 0) console.log(`Upserted ${count} verses...`);
  }

  console.log(`Done. Upserted ${count} verses.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

