#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const sampleSurahs = [
  {
    id: 1,
    surahNumber: 1,
    nameEn: "Al-Fatiha",
    nameTr: "Fatiha",
    nameAr: "الفاتحة",
    totalAyahs: 7,
    revelationType: "Meccan",
  },
  {
    id: 2,
    surahNumber: 2,
    nameEn: "Al-Baqarah",
    nameTr: "Bakara",
    nameAr: "البقرة",
    totalAyahs: 286,
    revelationType: "Medinan",
  },
];

const sampleVerses = [
  {
    id: "v1-1",
    surahNumber: 1,
    verseNumber: 1,
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    translation: "In the name of Allah, the Most Gracious, the Most Merciful",
  },
  {
    id: "v1-2",
    surahNumber: 1,
    verseNumber: 2,
    arabicText: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    translation: "Praise be to Allah, Lord of the worlds",
  },
  {
    id: "v1-3",
    surahNumber: 1,
    verseNumber: 3,
    arabicText: "الرَّحْمَٰنِ الرَّحِيمِ",
    translation: "The Most Gracious, the Most Merciful",
  },
  {
    id: "v1-4",
    surahNumber: 1,
    verseNumber: 4,
    arabicText: "مَالِكِ يَوْمِ الدِّينِ",
    translation: "Master of the Day of Judgment",
  },
  {
    id: "v1-5",
    surahNumber: 1,
    verseNumber: 5,
    arabicText: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    translation: "You alone we worship and You alone we ask for help",
  },
  {
    id: "v1-6",
    surahNumber: 1,
    verseNumber: 6,
    arabicText: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    translation: "Guide us to the straight path",
  },
  {
    id: "v1-7",
    surahNumber: 1,
    verseNumber: 7,
    arabicText:
      "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
    translation:
      "The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or those who are astray",
  },
  {
    id: "v2-255",
    surahNumber: 2,
    verseNumber: 255,
    arabicText:
      "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ",
    translation:
      "Allah - there is no deity except Him, the Ever-Living, the Self-Sustaining. Neither drowsiness overtakes Him nor sleep",
  },
];

async function insertSampleData() {
  try {
    console.log("🔄 Inserting sample data...");

    // Check if data already exists
    const existingVerse = await prisma.verse.findFirst({
      where: { id: "v1-1" },
    });
    if (existingVerse) {
      console.log("✅ Data already exists, skipping seed");
      return;
    }

    // Insert surahs
    for (const surah of sampleSurahs) {
      await prisma.surah.upsert({
        where: { id: surah.id },
        update: {},
        create: surah,
      });
    }
    console.log(`✅ Inserted ${sampleSurahs.length} surahs`);

    // Insert verses
    await prisma.verse.createMany({ data: sampleVerses, skipDuplicates: true });
    console.log(`✅ Inserted ${sampleVerses.length} verses`);

    console.log("✅ Sample data inserted successfully");
  } catch (error) {
    console.error("❌ Error inserting sample data:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

insertSampleData();
