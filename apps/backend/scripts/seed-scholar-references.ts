import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedScholarReferences() {
  console.log("Seeding ScholarReference from existing scholar data...\n");

  // Get all scholars with their bookId
  const scholars = await prisma.scholar.findMany({
    select: {
      id: true,
      name: true,
      bookId: true,
      detailInformation: true,
      explanation: true,
    },
  });

  console.log(`Found ${scholars.length} scholars`);

  let created = 0;
  let skipped = 0;

  for (const scholar of scholars) {
    // Skip if no bookId
    if (!scholar.bookId || !scholar.bookId.trim()) {
      skipped++;
      continue;
    }

    // Check if reference already exists
    const existing = await prisma.scholarReference.findFirst({
      where: { scholarId: scholar.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Derive source type from bookId pattern
    let sourceType = "BOOK";
    const bookIdLower = scholar.bookId.toLowerCase();
    if (bookIdLower.includes("t04") || bookIdLower.includes("tafsir")) {
      sourceType = "TAFSIR";
    } else if (bookIdLower.includes("t02")) {
      sourceType = "HADITH";
    }

    // Create a reference based on the scholar's known work
    await prisma.scholarReference.create({
      data: {
        scholarId: scholar.id,
        sourceType,
        sourceTitle:
          scholar.detailInformation ||
          scholar.explanation ||
          `Tefsir - ${scholar.name}`,
        provenance: `Derived from scholar.bookId: ${scholar.bookId}`,
        isPrimary: true,
      },
    });

    created++;
    if (created % 10 === 0) {
      console.log(`  Created ${created} references...`);
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);

  // Show summary
  const totalRefs = await prisma.scholarReference.count();
  console.log(`Total ScholarReferences in DB: ${totalRefs}`);

  await prisma.$disconnect();
}

seedScholarReferences().catch(console.error);
