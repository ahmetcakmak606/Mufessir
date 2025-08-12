import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import "dotenv/config";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedBatch(batchSize: number) {
  // Unsupported("vector") fields cannot be used in Prisma where filters; fetch with raw SQL
  const rows: Array<{ id: string; arabicText: string; tafsirText: string; scholarName: string }> =
    await prisma.$queryRawUnsafe(
      `SELECT t.id, v."arabicText", t."tafsirText", s."name" as "scholarName"
       FROM "Tafsir" t
       JOIN "Verse" v ON t."verseId" = v.id
       JOIN "Scholar" s ON t."scholarId" = s.id
       WHERE t."embedding" IS NULL
       ORDER BY t."createdAt" ASC
       LIMIT ${batchSize}`
    );

  if (rows.length === 0) return 0;

  for (const r of rows) {
    try {
      const textToEmbed = `${r.arabicText || ""}\n\n${r.tafsirText || ""}`.trim();
      if (!textToEmbed) continue;

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
      });

      const embedding = (response as any).data?.[0]?.embedding as number[] | undefined;
      if (!embedding) throw new Error("No embedding returned");

      await prisma.tafsir.update({ where: { id: r.id }, data: { embedding } });
      console.log(`✓ Embedded ${r.id} (${r.scholarName})`);
      await new Promise((res) => setTimeout(res, 100));
    } catch (err) {
      console.error(`✗ Failed ${r.id}:`, err);
    }
  }

  return rows.length;
}

async function main() {
  try {
    console.log("Starting tafsir embedding process...");
    const batch = Number(process.env.EMBED_BATCH_SIZE || 50);
    while (true) {
      const done = await embedBatch(batch);
      if (!done) break;
    }
    console.log("Embedding process completed!");
  } catch (e) {
    console.error("Error in embedding process:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();