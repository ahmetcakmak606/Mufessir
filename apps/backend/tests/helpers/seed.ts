import type { PrismaClient } from "@prisma/client";

export const SEED_VERSE_ID = "verse-1-1";
export const SEED_MUFASSIR_ID = 900001;

// Minimal, self-contained corpus fixture so route tests do not depend on the
// contents of any developer database.
export async function seedMinimalCorpus(prisma: PrismaClient): Promise<void> {
  await prisma.surah.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      surahNumber: 1,
      totalAyahs: 7,
      nameEn: "Al-Fatiha",
      nameTr: "Fâtiha",
    },
  });

  await prisma.verse.upsert({
    where: { id: "verse-1-1" },
    update: {},
    create: {
      id: "verse-1-1",
      surahNumber: 1,
      verseNumber: 1,
      arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      translation: "Rahman ve Rahim olan Allah'ın adıyla.",
    },
  });

  await prisma.verse.upsert({
    where: { id: "verse-1-2" },
    update: {},
    create: {
      id: "verse-1-2",
      surahNumber: 1,
      verseNumber: 2,
      arabicText: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
      translation: "Hamd, âlemlerin Rabbi Allah'a mahsustur.",
    },
  });

  await prisma.mufassir.upsert({
    where: { id: SEED_MUFASSIR_ID },
    update: {},
    create: {
      id: SEED_MUFASSIR_ID,
      nameEn: "Test Mufassir",
      nameTr: "Test Müfessir",
      nameAr: "مفسر تجريبي",
      reputationScore: 8,
      century: 9,
      madhab: "Hanafi",
      period: "CLASSICAL_MATURE",
    },
  });

  const existing = await prisma.tafsir.findFirst({
    where: { verseId: SEED_VERSE_ID, mufassirId: SEED_MUFASSIR_ID },
  });
  if (!existing) {
    await prisma.tafsir.create({
      data: {
        verseId: SEED_VERSE_ID,
        mufassirId: SEED_MUFASSIR_ID,
        tafsirText:
          "قال المفسر التجريبي: البسملة ذكرٌ لاسم الله الرحمن الرحيم قبل التلاوة، وفيها إشارة إلى الرحمة قبل العذاب.",
      },
    });
  }
}
