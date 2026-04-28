import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Maide 35 (5:35) Verse Kontrol ===\n");

  // Canonical ID
  const verseCanonical = await prisma.verse.findUnique({
    where: { id: "5:35" },
    include: { tafsirs: { take: 3 } },
  });

  console.log('✓ ID "5:35":', verseCanonical ? "Bulundu ✅" : "Bulunamadı ❌");
  if (verseCanonical) {
    console.log(`  - Surah: ${verseCanonical.surahNumber}, Verse: ${verseCanonical.verseNumber}`);
    console.log(`  - Tafsir sayısı: ${verseCanonical.tafsirs.length}`);
    verseCanonical.tafsirs.forEach((t) => console.log(`    * ${t.id.slice(0, 20)}...`));
  }

  // Alt formatlar
  const formats = [
    "5:35",
    "5-35",
    "verse-5-35",
    "535",
  ];

  console.log("\n=== Alt formatları test et ===");

  for (const fmt of formats) {
    const v = await prisma.verse.findUnique({
      where: { id: fmt },
    });
    console.log(`  ID "${fmt}":`, v ? "✅" : "❌");
  }

  // Raw SQL ile kontrol
  console.log("\n=== Veritabanında var mı? (Raw SQL) ===");
  const rawResult = await prisma.$queryRaw`
    SELECT id, surah_id, ayah_number FROM ayahs 
    WHERE surah_id = 5 AND ayah_number = 35
    LIMIT 1
  `;
  console.log("Result:", rawResult);

  // Tüm tafsirler
  if (verseCanonical?.id) {
    console.log("\n=== Tüm tafsirler (Maide 35) ===");
    const allTafsirs = await prisma.tafsir.findMany({
      where: { verseId: verseCanonical.id },
      include: { mufassir: { select: { nameEn: true } } },
    });
    console.log(`Total: ${allTafsirs.length}`);
    allTafsirs.slice(0, 5).forEach((t) => {
      console.log(`  - ${t.mufassir?.nameEn}: ${t.tafsirText.slice(0, 50)}...`);
    });
  }

  // Benzer şekilde Fatiha 1'i de kontrol et
  console.log("\n=== Karşılaştırma: Fatiha 1 (1:1) ===");
  const fatiha = await prisma.verse.findUnique({
    where: { id: "1:1" },
    include: { tafsirs: { take: 3 } },
  });
  console.log("Fatiha 1:", fatiha ? "✅" : "❌");
  if (fatiha) {
    console.log(`  - Tafsir sayısı: ${fatiha.tafsirs.length}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
