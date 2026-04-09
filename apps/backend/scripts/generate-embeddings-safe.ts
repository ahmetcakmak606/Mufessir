#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, "../../../.env") });
}

const prisma = new PrismaClient();

const BATCH_SIZE = 10; // Small batch for stability
const DELAY_MS = 500; // 500ms delay between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

interface TafsirRow {
  id: string;
  tafsirText: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEmbeddingOllama(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "curl",
      [
        "-s",
        "http://localhost:11434/api/embeddings",
        "-d",
        JSON.stringify({ model: "nomic-embed-text", prompt: text }),
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let output = "";
    let errorOutput = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Ollama error: ${errorOutput}`));
        return;
      }

      try {
        const parsed = JSON.parse(output);
        if (!parsed.embedding) {
          reject(new Error(`No embedding in response`));
          return;
        }
        resolve(parsed.embedding);
      } catch {
        reject(new Error(`Failed to parse Ollama output`));
      }
    });
  });
}

async function generateWithRetry(
  text: string,
  retries = MAX_RETRIES,
): Promise<number[] | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const embedding = await generateEmbeddingOllama(text);
      return embedding;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      // Check if it's a rate limit
      if (
        errorMsg.toLowerCase().includes("rate") ||
        errorMsg.toLowerCase().includes("too many")
      ) {
        const waitTime = RETRY_DELAY_MS * attempt;
        console.log(
          `    Rate limited, waiting ${waitTime / 1000}s before retry ${attempt}/${retries}...`,
        );
        await sleep(waitTime);
        continue;
      }

      // Non-retryable error
      if (attempt === retries) {
        return null;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }
  return null;
}

async function generateEmbeddings() {
  console.log("Starting embedding generation (rate-limit safe)...\n");
  console.log(`Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms\n`);

  // Check column exists
  try {
    await prisma.$queryRawUnsafe(
      `SELECT embedding::text FROM "Tafsir" LIMIT 1`,
    );
  } catch (e) {
    console.error("Error: 'embedding' column doesn't exist in database.");
    process.exit(1);
  }

  // Get counts
  const totalResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Tafsir"`,
  );
  const total = Number(totalResult[0]?.count || 0);

  const withEmbedResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Tafsir" WHERE embedding IS NOT NULL`,
  );
  const withEmbed = Number(withEmbedResult[0]?.count || 0);

  const remainingResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Tafsir" WHERE embedding IS NULL AND LENGTH("tafsirText") > 50`,
  );
  const remaining = Number(remainingResult[0]?.count || 0);

  console.log(`Total tafsirs: ${total}`);
  console.log(`With embeddings: ${withEmbed}`);
  console.log(`Remaining (text > 50 chars): ${remaining}`);
  console.log(
    `Estimated time: ${Math.round((remaining * (DELAY_MS + 100)) / 60000)} minutes\n`,
  );

  let processed = 0;
  let errors = 0;
  let skipped = 0;
  let rateLimited = 0;

  const startTime = Date.now();

  while (true) {
    const tafsirs = await prisma.$queryRawUnsafe<TafsirRow[]>(
      `SELECT id, "tafsirText" FROM "Tafsir" WHERE embedding IS NULL AND LENGTH("tafsirText") > 50 ORDER BY id LIMIT ${BATCH_SIZE}`,
    );

    if (tafsirs.length === 0) {
      console.log("\nNo more tafsirs to process!");
      break;
    }

    console.log(`\nBatch: ${tafsirs.length} records`);

    for (const tafsir of tafsirs) {
      try {
        // Truncate long texts
        const textToEmbed = tafsir.tafsirText.slice(0, 8000);

        const embedding = await generateWithRetry(textToEmbed);

        if (!embedding) {
          console.log(`  Failed after retries: ${tafsir.id}`);
          errors++;
          skipped++;
          continue;
        }

        const vectorStr = `[${embedding.join(",")}]`;

        await prisma.$executeRawUnsafe(
          `UPDATE "Tafsir" SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          tafsir.id,
        );

        processed++;

        // Progress every 50
        if (processed % 50 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 60000);
          const rate = Math.round(processed / elapsed);
          console.log(
            `  Progress: ${processed} done, ${rate}/min, ${errors} errors`,
          );
        }

        // Delay between requests
        await sleep(DELAY_MS);
      } catch (err) {
        errors++;
        if (
          err instanceof Error &&
          err.message.toLowerCase().includes("rate")
        ) {
          rateLimited++;
          console.log(`  Rate limited: ${tafsir.id}, waiting longer...`);
          await sleep(10000); // Extra wait on rate limit
        }
      }
    }

    // Small delay between batches
    await sleep(100);
  }

  const elapsed = Math.round((Date.now() - startTime) / 60000);

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors/Skipped: ${errors}`);
  console.log(`Rate limited: ${rateLimited}`);
  console.log(`Time: ${elapsed} minutes`);
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
