#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the project root
config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

async function insertSampleData() {
  try {
    console.log('🔄 Inserting sample data...\n');

    // Insert sample data directly using Prisma
    console.log('📝 Inserting sample data...');

    // Insert verses
    await prisma.verse.createMany({
      data: [
        {
          id: 'verse-1-1',
          surahNumber: 1,
          surahName: 'Al-Fatiha',
          verseNumber: 1,
          arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
          transliteration: 'Bismillahi r-rahmani r-rahim',
          translation: 'In the name of Allah, the Most Gracious, the Most Merciful'
        },
        {
          id: 'verse-1-2',
          surahNumber: 1,
          surahName: 'Al-Fatiha',
          verseNumber: 2,
          arabicText: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
          transliteration: 'Alhamdu lillahi rabbi l-alamin',
          translation: 'Praise be to Allah, Lord of the worlds'
        },
        {
          id: 'verse-2-255',
          surahNumber: 2,
          surahName: 'Al-Baqarah',
          verseNumber: 255,
          arabicText: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ',
          transliteration: 'Allahu la ilaha illa huwa l-hayyu l-qayyum',
          translation: 'Allah - there is no deity except Him, the Ever-Living, the Self-Sustaining'
        },
        {
          id: 'verse-3-64',
          surahNumber: 3,
          surahName: 'Al-Imran',
          verseNumber: 64,
          arabicText: 'قُلْ يَا أَهْلَ الْكِتَابِ تَعَالَوْا إِلَىٰ كَلِمَةٍ سَوَاءٍ بَيْنَنَا وَبَيْنَكُمْ',
          transliteration: 'Qul ya ahla l-kitabi ta\'alaw ila kalimatin sawa\'in baynana wa baynakum',
          translation: 'Say, O People of the Scripture, come to a word that is equitable between us and you'
        },
        {
          id: 'verse-112-1',
          surahNumber: 112,
          surahName: 'Al-Ikhlas',
          verseNumber: 1,
          arabicText: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
          transliteration: 'Qul huwa Allahu ahad',
          translation: 'Say, He is Allah, [who is] One'
        }
      ],
      skipDuplicates: true
    });

    // Insert scholars
    const scholarSeed = [
        {
          id: 'scholar-tabari',
          name: 'Abu Ja\'far al-Tabari',
          mufassirTr: 'Taberî',
          mufassirEn: 'Al-Tabari',
          mufassirAr: 'الطبري',
          mufassirNameLong: 'Muhammad ibn Jarir al-Tabari',
          birthYear: 839,
          deathYear: 923,
          deathHijri: 310,
          century: 9,
          madhab: 'Shafi\'i',
          period: 'Abbasid',
          periodCode: 'CLASSICAL_EARLY',
          environment: 'Dar al-Islam',
          originCountry: 'Persia',
          reputationScore: 5.0,
          scholarlyInfluence: 5,
          methodologicalRigor: 5,
          corpusBreadth: 5,
          traditionAcceptance: ['SUNNI_MAINSTREAM', 'CROSS_TRADITION'],
          sourceAccessibility: 'FULL_DIGITAL',
          tafsirType1: 'RIVAYET'
        },
        {
          id: 'scholar-qurtubi',
          name: 'Al-Qurtubi',
          mufassirTr: 'Kurtubî',
          mufassirEn: 'Al-Qurtubi',
          mufassirAr: 'القرطبي',
          mufassirNameLong: 'Abu Abdullah al-Qurtubi',
          birthYear: 1214,
          deathYear: 1273,
          deathHijri: 671,
          century: 13,
          madhab: 'Maliki',
          period: 'Almohad',
          periodCode: 'CLASSICAL_MATURE',
          environment: 'Dar al-Islam',
          originCountry: 'Al-Andalus',
          reputationScore: 4.3,
          scholarlyInfluence: 4,
          methodologicalRigor: 5,
          corpusBreadth: 4,
          traditionAcceptance: ['SUNNI_MAINSTREAM'],
          sourceAccessibility: 'FULL_DIGITAL',
          tafsirType1: 'FIKHI'
        },
        {
          id: 'scholar-kathir',
          name: 'Ibn Kathir',
          mufassirTr: 'İbn Kesîr',
          mufassirEn: 'Ibn Kathir',
          mufassirAr: 'ابن كثير',
          mufassirNameLong: 'Ismail ibn Umar ibn Kathir',
          birthYear: 1300,
          deathYear: 1373,
          deathHijri: 774,
          century: 14,
          madhab: 'Shafi\'i',
          period: 'Mamluk',
          periodCode: 'POST_CLASSICAL',
          environment: 'Dar al-Islam',
          originCountry: 'Syria',
          reputationScore: 4.7,
          scholarlyInfluence: 5,
          methodologicalRigor: 4,
          corpusBreadth: 5,
          traditionAcceptance: ['SUNNI_MAINSTREAM'],
          sourceAccessibility: 'FULL_DIGITAL',
          tafsirType1: 'RIVAYET'
        },
        {
          id: 'scholar-razi',
          name: 'Fakhr al-Din al-Razi',
          mufassirTr: 'Fahreddin Râzî',
          mufassirEn: 'Fakhr al-Din al-Razi',
          mufassirAr: 'فخر الدين الرازي',
          mufassirNameLong: 'Fakhr al-Din Muhammad al-Razi',
          birthYear: 1149,
          deathYear: 1210,
          deathHijri: 606,
          century: 12,
          madhab: 'Shafi\'i',
          period: 'Ayyubid',
          periodCode: 'CLASSICAL_MATURE',
          environment: 'Dar al-Islam',
          originCountry: 'Persia',
          reputationScore: 4.7,
          scholarlyInfluence: 5,
          methodologicalRigor: 5,
          corpusBreadth: 4,
          traditionAcceptance: ['SUNNI_MAINSTREAM', 'CROSS_TRADITION'],
          sourceAccessibility: 'FULL_DIGITAL',
          tafsirType1: 'DIRAYET'
        },
        {
          id: 'scholar-baydawi',
          name: 'Al-Baydawi',
          mufassirTr: 'Beydâvî',
          mufassirEn: 'Al-Baydawi',
          mufassirAr: 'البيضاوي',
          mufassirNameLong: 'Nasir al-Din al-Baydawi',
          birthYear: 1226,
          deathYear: 1286,
          deathHijri: 685,
          century: 13,
          madhab: 'Shafi\'i',
          period: 'Ilkhanate',
          periodCode: 'CLASSICAL_MATURE',
          environment: 'Dar al-Islam',
          originCountry: 'Persia',
          reputationScore: 4.0,
          scholarlyInfluence: 4,
          methodologicalRigor: 4,
          corpusBreadth: 4,
          traditionAcceptance: ['SUNNI_MAINSTREAM'],
          sourceAccessibility: 'FULL_DIGITAL',
          tafsirType1: 'DIRAYET'
        }
    ];
    for (const scholar of scholarSeed) {
      await prisma.scholar.upsert({
        where: { id: scholar.id },
        update: scholar,
        create: scholar,
      });
    }

    await prisma.scholarReference.deleteMany({
      where: {
        provenance: 'manual_seed',
        scholarId: {
          in: scholarSeed.map((s) => s.id),
        },
      },
    });
    await prisma.scholarReference.createMany({
      data: [
        {
          scholarId: 'scholar-tabari',
          sourceType: 'DIA',
          sourceTitle: 'TDV İslâm Ansiklopedisi',
          volume: '39',
          page: '284-292',
          edition: 'İstanbul, TDV',
          citationText: 'Taberî maddesi',
          provenance: 'manual_seed',
          isPrimary: true
        },
        {
          scholarId: 'scholar-tabari',
          sourceType: 'ZEHEBI',
          sourceTitle: 'et-Tefsîr ve’l-Müfessirûn',
          volume: '1',
          page: '115-125',
          edition: 'Dârü’l-Hadîs',
          citationText: 'Taberî metodolojisi',
          provenance: 'manual_seed',
          isPrimary: true
        },
        {
          scholarId: 'scholar-razi',
          sourceType: 'DIA',
          sourceTitle: 'TDV İslâm Ansiklopedisi',
          volume: '34',
          page: '479-485',
          edition: 'İstanbul, TDV',
          citationText: 'Râzî maddesi',
          provenance: 'manual_seed',
          isPrimary: true
        },
        {
          scholarId: 'scholar-kathir',
          sourceType: 'DIA',
          sourceTitle: 'TDV İslâm Ansiklopedisi',
          volume: '20',
          page: '132-134',
          edition: 'İstanbul, TDV',
          citationText: 'İbn Kesîr maddesi',
          provenance: 'manual_seed',
          isPrimary: true
        }
      ],
      skipDuplicates: true
    });

    // Insert tafsirs
    await prisma.tafsir.createMany({
      data: [
        {
          id: 'tafsir-1-1-tabari',
          verseId: 'verse-1-1',
          scholarId: 'scholar-tabari',
          tafsirText: 'The opening of the Quran begins with the Basmala, which is a declaration of reliance upon Allah. Al-Tabari explains that "Bismillah" means "I begin with the name of Allah" and that ar-Rahman and ar-Rahim are two of the most beautiful names of Allah, both deriving from mercy (rahma). Rahman indicates the all-encompassing mercy of Allah for all His creation, while Rahim refers to the specific mercy reserved for the believers in the Hereafter.',
          tafsirType: 'Linguistic',
          keywords: ['Basmala', 'mercy', 'Rahman', 'Rahim'],
          languageLevel: 8,
          emotionalRatio: 0.3
        },
        {
          id: 'tafsir-1-2-tabari',
          verseId: 'verse-1-2',
          scholarId: 'scholar-tabari',
          tafsirText: 'Al-Tabari interprets "Alhamdu lillahi" as a statement of praise that belongs to Allah alone. He explains that "rabb" (Lord) signifies the One who creates, sustains, and manages all affairs. "Al-alamin" (the worlds) refers to all that exists besides Allah - the world of humans, jinn, angels, and all other creatures. This verse establishes Allah\'s absolute sovereignty over all creation.',
          tafsirType: 'Linguistic',
          keywords: ['praise', 'lordship', 'creation', 'sovereignty'],
          languageLevel: 8,
          emotionalRatio: 0.4
        },
        {
          id: 'tafsir-2-255-kathir',
          verseId: 'verse-2-255',
          scholarId: 'scholar-kathir',
          tafsirText: 'This is the famous Ayat al-Kursi (Verse of the Throne), which Ibn Kathir describes as the greatest verse in the Quran. The verse begins with a emphatic declaration of monotheism: "Allah - there is no deity except Him." The attributes mentioned - Al-Hayy (the Ever-Living) and Al-Qayyum (the Self-Sustaining) - encompass all of Allah\'s perfect attributes. Ibn Kathir explains that Allah\'s knowledge encompasses all things, His throne extends over the heavens and earth, and maintaining them is not burdensome for Him.',
          tafsirType: 'Doctrinal',
          keywords: ['monotheism', 'throne', 'knowledge', 'sovereignty'],
          languageLevel: 9,
          emotionalRatio: 0.2
        },
        {
          id: 'tafsir-3-64-razi',
          verseId: 'verse-3-64',
          scholarId: 'scholar-razi',
          tafsirText: 'Fakhr al-Din al-Razi explains this verse as a call to dialogue and common ground between Muslims and the People of the Book (Christians and Jews). The "word that is equitable" (kalimatin sawa\'in) refers to the fundamental principle of monotheism - worshipping Allah alone without partners. Al-Razi emphasizes that this verse demonstrates Islam\'s approach of seeking common ground while maintaining theological distinctiveness.',
          tafsirType: 'Theological',
          keywords: ['dialogue', 'monotheism', 'People of the Book', 'common ground'],
          languageLevel: 9,
          emotionalRatio: 0.5
        },
        {
          id: 'tafsir-112-1-qurtubi',
          verseId: 'verse-112-1',
          scholarId: 'scholar-qurtubi',
          tafsirText: 'Al-Qurtubi explains that Surah Al-Ikhlas, though brief, encapsulates the essence of monotheistic belief. The command "Qul" (Say) emphasizes the prophetic proclamation of this fundamental truth. "Huwa" (He) serves as a pronoun of emphasis, while "Allah" is the proper name of God. "Ahad" (One) signifies absolute unity and uniqueness, indicating that Allah is one in His essence, attributes, and actions, with no partners or equals.',
          tafsirType: 'Theological',
          keywords: ['monotheism', 'unity', 'uniqueness', 'essence'],
          languageLevel: 8,
          emotionalRatio: 0.3
        },
        {
          id: 'tafsir-1-1-baydawi',
          verseId: 'verse-1-1',
          scholarId: 'scholar-baydawi',
          tafsirText: 'Al-Baydawi provides a philosophical approach to the Basmala, explaining that beginning with Allah\'s name indicates seeking blessing and success in all endeavors. He discusses the grammatical structure, noting that the preposition "bi" (with) implies instrumentality - we accomplish things through Allah\'s name. The dual mention of mercy (Rahman, Rahim) emphasizes that Allah\'s mercy is the predominant attribute in His dealings with creation.',
          tafsirType: 'Philosophical',
          keywords: ['blessing', 'grammar', 'instrumentality', 'mercy'],
          languageLevel: 9,
          emotionalRatio: 0.4
        }
      ],
      skipDuplicates: true
    });

    // Verify the data was inserted
    const verseCount = await prisma.verse.count();
    const scholarCount = await prisma.scholar.count();
    const tafsirCount = await prisma.tafsir.count();
    const citationCount = await prisma.scholarReference.count();

    console.log('\n📊 Database Summary:');
    console.log(`   Verses: ${verseCount}`);
    console.log(`   Scholars: ${scholarCount}`);
    console.log(`   Tafsirs: ${tafsirCount}`);
    console.log(`   Scholar references: ${citationCount}`);

    console.log('\n🎉 Sample data insertion completed!');
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertSampleData(); 
