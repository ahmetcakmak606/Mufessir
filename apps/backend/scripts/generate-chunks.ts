#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { cl100k_base } from "gpt-tokenizer";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../src/embedding-constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, "../../../.env") });
}

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOKEN_LIMIT = 8192;
const CHUNK_TARGET = 6500;
const CHUNK_HARD_CAP = 8000;

interface TafsirRow {
  id: string;
  mufassir_id: number;
  verse_id: string;
  commentary: string;
  methodTags: string[];
}

function countTokens(text: string): number {
  return cl100k_base.encode(text).length;
}

function splitIntoParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.filter((p) => p.trim().length > 0);
}

function hardSplitParagraph(text: string, maxTokens: number): string[] {
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const encoded = cl100k_base.encode(remaining);
    if (encoded.length <= maxTokens) {
      parts.push(remaining);
      break;
    }
    const safeEnd = findSplitPoint(remaining, maxTokens);
    parts.push(remaining.slice(0, safeEnd));
    remaining = remaining.slice(safeEnd).trim();
  }
  return parts;
}

function findSplitPoint(text: string, maxTokens: number): number {
  const encoded = cl100k_base.encode(text);
  const tokenSlice = encoded.slice(0, maxTokens);
  const approxChar = Math.min(
    text.length,
    Math.floor((maxTokens / encoded.length) * text.length) + 500,
  );
  const candidates = [
    text.lastIndexOf(". ", approxChar),
    text.lastIndexOf(".\n", approxChar),
    text.lastIndexOf("? ", approxChar),
    text.lastIndexOf("! ", approxChar),
    text.lastIndexOf(" ", approxChar),
  ];
  const best = candidates
    .filter((c) => c > text.length * 0.3)
    .sort((a, b) => b - a);
  if (best.length > 0) return best[0] + 1;
  return approxChar;
}

function packParagraphsIntoChunks(paragraphs: string[]): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    if (paraTokens > CHUNK_HARD_CAP) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [];
        currentTokens = 0;
      }
      const subParts = hardSplitParagraph(para, CHUNK_HARD_CAP);
      for (const part of subParts) {
        chunks.push(part);
      }
      continue;
    }

    if (currentTokens + paraTokens > CHUNK_TARGET && currentChunk.length > 0) {
      if (currentTokens + paraTokens <= CHUNK_HARD_CAP) {
        currentChunk.push(para);
        currentTokens += paraTokens;
      } else {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [para];
        currentTokens = paraTokens;
      }
    } else {
      currentChunk.push(para);
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;
}

async function embedWithRetry(
  text: string,
  retries = 3,
): Promise<number[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        input: text,
      });
      return response.data[0].embedding;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("insufficient_quota")) {
        console.error("FATAL: OpenAI insufficient_quota — add credit and retry.");
        process.exit(1);
      }
      if (attempt < retries) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`Embed attempt ${attempt + 1} failed: ${msg}. Retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

async function generateChunks() {
  console.log("Starting chunk generation (gpt-tokenizer / cl100k_base)...\n");

  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM all_tafsirs WHERE embed = TRUE AND LENGTH(commentary) > 20000`,
  );
  const candidateCount = Number(countResult[0]?.count || 0);
  console.log(`Candidate overflow rows (LENGTH > 20000): ${candidateCount}`);

  let processed = 0;
  let chunkCount = 0;
  const BATCH_SIZE = 50;

  while (true) {
    const rows = await prisma.$queryRawUnsafe<TafsirRow[]>(
      `SELECT id, mufassir_id, verse_id, commentary, "methodTags" FROM all_tafsirs WHERE embed = TRUE AND LENGTH(commentary) > 20000 AND id NOT IN (SELECT DISTINCT parent_id FROM tafsir_chunks) LIMIT ${BATCH_SIZE}`,
    );

    if (rows.length === 0) break;

    for (const row of rows) {
      const tokenCount = countTokens(row.commentary);
      if (tokenCount <= TOKEN_LIMIT) continue;

      const paragraphs = splitIntoParagraphs(row.commentary);
      const chunks = packParagraphsIntoChunks(paragraphs);

      for (let i = 0; i < chunks.length; i++) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO tafsir_chunks (parent_id, mufassir_id, verse_id, chunk_index, commentary) VALUES ($1::text, $2, $3, $4, $5) ON CONFLICT (parent_id, chunk_index) DO NOTHING`,
            String(row.id),
            row.mufassir_id,
            row.verse_id,
            i,
            chunks[i],
          );
          chunkCount++;
        } catch (err) {
          console.error(`  Error inserting chunk ${i} for ${row.id}:`, err);
        }
      }
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed} rows, ${chunkCount} chunks...`);
      }
    }
  }

  console.log(`\n=== Chunk generation complete ===`);
  console.log(`Rows chunked: ${processed}, Total chunks: ${chunkCount}`);

  console.log("\nStarting chunk embedding phase...\n");
  let embedded = 0;
  let embedErrors = 0;

  while (true) {
    const unembedded = await prisma.$queryRawUnsafe<
      { id: bigint; commentary: string }[]
    >(
      `SELECT id, commentary FROM tafsir_chunks WHERE embedding IS NULL LIMIT ${BATCH_SIZE}`,
    );

    if (unembedded.length === 0) break;

    for (const chunk of unembedded) {
      try {
        const embedding = await embedWithRetry(chunk.commentary);
        const vectorStr = `[${embedding.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE tafsir_chunks SET embedding = $1::vector WHERE id = $2`,
          vectorStr,
          chunk.id,
        );
        embedded++;
        if (embedded % 50 === 0) {
          console.log(`  Embedded ${embedded} chunks...`);
        }
      } catch (err) {
        embedErrors++;
        console.error(`  Error embedding chunk ${chunk.id}:`, err);
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n=== Embedding phase complete ===`);
  console.log(`Embedded: ${embedded}, Errors: ${embedErrors}`);

  await prisma.$disconnect();
}

generateChunks().catch((e) => {
  console.error(e);
  process.exit(1);
});
