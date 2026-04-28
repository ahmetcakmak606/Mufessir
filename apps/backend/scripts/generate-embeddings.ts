#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, "../../../.env") });
}

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 50;
const MODEL = "text-embedding-3-small";

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({ model: MODEL, input: text });
  return response.data[0].embedding;
}

async function main() {
  console.log("Starting embedding generation (OpenAI text-embedding-3-small)...\n");

  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM all_tafsirs WHERE embedding IS NULL`,
  );
  const total = Number(countResult[0]?.count || 0);
  console.log(`Tafsirs without embeddings: ${total}`);

  let processed = 0;
  let errors = 0;

  while (true) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; commentary: string }[]>(
      `SELECT id, commentary FROM all_tafsirs WHERE embedding IS NULL AND LENGTH(commentary) > 20 LIMIT ${BATCH_SIZE}`,
    );

    if (rows.length === 0) break;

    console.log(`Processing batch of ${rows.length}...`);

    for (const row of rows) {
      try {
        const embedding = await generateEmbedding(row.commentary);
        const vectorStr = `[${embedding.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE all_tafsirs SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          row.id,
        );
        processed++;
        if (processed % 50 === 0) console.log(`  Processed ${processed}...`);
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error on ${row.id}: ${msg}`);
        if (msg.toLowerCase().includes("rate")) {
          console.log("Rate limited, waiting 10s...");
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n=== Done ===`);
  console.log(`Processed: ${processed}, Errors: ${errors}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
