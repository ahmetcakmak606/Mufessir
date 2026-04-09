#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 100;
const MODEL = "text-embedding-3-small";

interface TafsirRow {
  id: string;
  tafsirText: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function generateEmbeddings() {
  console.log("Starting embedding generation...\n");

  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Tafsir" WHERE embedding IS NULL`,
  );
  const totalTafsirs = Number(countResult[0]?.count || 0);

  console.log(`Total tafsirs without embeddings: ${totalTafsirs}`);

  let processed = 0;
  let errors = 0;

  while (true) {
    const tafsirs = await prisma.$queryRawUnsafe<TafsirRow[]>(
      `SELECT id, "tafsirText" FROM "Tafsir" WHERE embedding IS NULL LIMIT ${BATCH_SIZE}`,
    );

    if (tafsirs.length === 0) {
      console.log("\nNo more tafsirs to process!");
      break;
    }

    console.log(`Processing batch of ${tafsirs.length}...`);

    for (const tafsir of tafsirs) {
      try {
        if (!tafsir.tafsirText || tafsir.tafsirText.trim().length === 0) {
          console.log(`  Skipping ${tafsir.id} - empty text`);
          continue;
        }

        const embedding = await generateEmbedding(tafsir.tafsirText);

        const vectorStr = `[${embedding.join(",")}]`;

        await prisma.$executeRaw`
          UPDATE "Tafsir"
          SET embedding = ${vectorStr}::vector
          WHERE id = ${tafsir.id}
        `;

        processed++;
        if (processed % 100 === 0) {
          console.log(`  Processed ${processed} tafsirs...`);
        }
      } catch (err) {
        errors++;
        console.error(
          `  Error processing ${tafsir.id}:`,
          err instanceof Error ? err.message : "Unknown error",
        );

        if (
          err instanceof Error &&
          err.message.toLowerCase().includes("rate")
        ) {
          console.log("Rate limited, waiting 5 seconds...");
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
}

async function main() {
  try {
    await generateEmbeddings();
  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
