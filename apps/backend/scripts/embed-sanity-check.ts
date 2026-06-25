#!/usr/bin/env node
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "text-embedding-3-large";
const DIMENSIONS = 1536;
const MAX_CHARS = 8000;  // ~5300 token, guvenli
const TEST_VERSES = ["27-18", "27-19", "3-7", "20-5", "24-35"];

async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  const res = await openai.embeddings.create({ model: MODEL, input, dimensions: DIMENSIONS });
  return res.data[0].embedding;
}

async function main() {
  console.log(`Sanity-check: ${MODEL} @ ${DIMENSIONS}d, ${TEST_VERSES.length} verses\n`);

  const rows = await prisma.$queryRawUnsafe<{ id: string; commentary: string }[]>(
    `SELECT id, commentary FROM all_tafsirs
     WHERE verse_id = ANY($1::text[]) AND LENGTH(commentary) > 20`,
    TEST_VERSES,
  );
  console.log(`Rows to embed: ${rows.length}\n`);

  let processed = 0, errors = 0;
  for (const row of rows) {
    try {
      const emb = await generateEmbedding(row.commentary);
      if (emb.length !== DIMENSIONS) throw new Error(`dim mismatch: ${emb.length}`);
      await prisma.$executeRawUnsafe(
        `UPDATE all_tafsirs SET embedding = $1::vector WHERE id = $2`,
        `[${emb.join(",")}]`, row.id,
      );
      processed++;
      if (processed % 25 === 0) console.log(`  ${processed}/${rows.length}`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error ${row.id}: ${msg}`);
      if (msg.toLowerCase().includes("rate")) await new Promise(r => setTimeout(r, 10000));
    }
  }
  console.log(`\nDone. Processed: ${processed}, Errors: ${errors}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
