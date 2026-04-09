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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "curl",
      [
        "-s",
        "http://localhost:11434/api/embeddings",
        "-d",
        JSON.stringify({
          model: "nomic-embed-text",
          prompt: text.slice(0, 8000),
        }),
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
        } else {
          reject(new Error("No embedding: " + output.slice(0, 100)));
        }
      } catch (e) {
        reject(new Error("Parse error: " + output.slice(0, 100)));
      }
    });

    proc.on("error", (e) => reject(e));
  });
}

async function main() {
  console.log("Testing single record...\n");

  // Get one record
  const rows = await prisma.$queryRawUnsafe<
    { id: string; tafsirText: string }[]
  >(
    `SELECT id, "tafsirText" FROM "Tafsir" WHERE embedding IS NULL AND LENGTH("tafsirText") > 50 LIMIT 1`,
  );

  if (rows.length === 0) {
    console.log("No records to process");
    return;
  }

  const row = rows[0];
  console.log("Testing record:", row.id);
  console.log("Text length:", row.tafsirText.length);

  try {
    const embedding = await generateEmbedding(row.tafsirText);
    console.log("Embedding length:", embedding.length);

    // Save it
    await prisma.$executeRawUnsafe(
      `UPDATE "Tafsir" SET embedding = $1::vector WHERE id = $2`,
      `[${embedding.join(",")}]`,
      row.id,
    );
    console.log("Saved!");
  } catch (e) {
    console.log("Error:", e.message);
  }

  await prisma.$disconnect();
}

main();
