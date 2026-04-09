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

const MAX_TEXT_LENGTH = 4000; // Ollama has context limits
const DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const truncated = text.slice(0, MAX_TEXT_LENGTH);
    const proc = spawn(
      "curl",
      [
        "-s",
        "http://localhost:11434/api/embeddings",
        "-d",
        JSON.stringify({ model: "nomic-embed-text", prompt: truncated }),
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let output = "",
      errorOutput = "";
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (errorOutput += d.toString()));

    proc.on("close", () => {
      try {
        const parsed = JSON.parse(output);
        if (parsed.embedding) {
          resolve(parsed.embedding);
        } else if (parsed.error) {
          reject(new Error(parsed.error));
        } else {
          reject(new Error("No embedding"));
        }
      } catch (e) {
        reject(new Error("Parse error"));
      }
    });

    proc.on("error", (e) => reject(e));
  });
}

async function main() {
  console.log("Starting embedding generation (truncated to 4000 chars)...\n");

  let processed = 0;
  let errors = 0;

  while (true) {
    const rows = await prisma.$queryRawUnsafe<
      { id: string; tafsirText: string }[]
    >(
      `SELECT id, "tafsirText" FROM "Tafsir" WHERE embedding IS NULL AND LENGTH("tafsirText") > 50 LIMIT 50`,
    );

    if (rows.length === 0) {
      console.log("\nDone!");
      break;
    }

    console.log(`Batch: ${rows.length} records...`);

    for (const row of rows) {
      try {
        const embedding = await generateEmbedding(row.tafsirText);
        if (embedding && embedding.length === 768) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Tafsir" SET embedding = $1::vector WHERE id = $2`,
            `[${embedding.join(",")}]`,
            row.id,
          );
          processed++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }

      if (processed % 50 === 0 && processed > 0) {
        console.log(`  Progress: ${processed} done, ${errors} errors`);
      }

      await sleep(DELAY_MS);
    }
  }

  console.log(`\nFinal: ${processed} processed, ${errors} errors`);
  await prisma.$disconnect();
}

main().catch(console.error);
