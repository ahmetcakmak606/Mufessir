#!/usr/bin/env node
/**
 * run-kite-harness.ts
 * KITE 63-koşu orkestratörü — JSON-first, sequential, idempotent-resume.
 *
 * Çalıştır:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/run-kite-harness.ts [cells.json] [output.jsonl]
 *
 * - cells.json yoksa generate-kite-cells.ts'den üretilir.
 * - output.jsonl varsa tamamlanan runId'ler atlanır (idempotent-resume).
 * - Her koşu append edilir; yarıda kesilse kaldığı yerden devam.
 * - STRICT_VECTOR=true — sessiz fallback yok; API/kota hatasında durur.
 *
 * Production parity kontrolleri (brif §2.4):
 *   - Query: verse.arabicText (saf, ayah_text_tr değil — tafseer.ts:675 fix)
 *   - Excerpt: 500 char kırpma, sliceLimit=5 (tafseer.ts:965,976-989 ile birebir)
 *   - maxTokens: 800 (lengthScale=6 default, tafseer.ts:1275-1276)
 *   - Prompt zinciri: loadCitations + keyArabicTerms + analyzeScholarGroup (export edildi)
 *   - mufassir alias: similarity-search.ts:375 fix ile kaynakta mevcut
 *   - limit: cell.limit (M4=10, M5=3 — retrieval depth ekseni; eşik=0.3 allN'de anlamsız bulundu)
 *
 * Snapshot alanları (brif §2.2 + oturum kararları):
 *   systemFingerprint — replikasyon deterministik mi? (brif §2.1)
 *   retrieved_all     — top-k tüm retrieved (C1/C2 analiz birimi)
 *   prompt_included   — sliceLimit=5 sonrası generation'a giren (daralma katmanı)
 *   promptVariant     — "group" | "individual" (instruction 5 dallanması)
 *   promptHash        — tam prompt'un hash'i (reproducibility kanıtı)
 *
 * Reproducibility snapshot'ı (v2 — 2026-09-02, ileriye dönük):
 *   snapshotSchema    — "v2" (v1 = 2026-06-22 63-run, bu alanlar yok)
 *   queryText         — retrieval'a giren saf sorgu metni
 *   queryEmbeddingHash— sorgu vektörünün sha256'sı; tam vektör sidecar'da
 *                       (<output>.query-embeddings.jsonl) — birebir yeniden koşum için
 *   retrieved_all[].contentHash — sha256(commentary); tafsirId serial PK olduğundan
 *                       korpus yeniden kurulumunda (id yeniden atanır) içerikten eşleme
 *   corpus            — { embeddingModel, embeddingDimensions, version }
 *                       version = env CORPUS_VERSION (korpus reload damgası)
 *
 * Kirli translation notu (Appendix B):
 *   promptOptions.translation = verse.translation (ayah_text_tr) — Arapça + Latin künye.
 *   Retrieval sorgusundan temizlendi (tafseer.ts:675) ama generation prompt'unda korundu
 *   (production parity; prompt'ta "Translation:" bölümü olarak görünür).
 *
 * Mustafa Sabri notu (Appendix B):
 *   extended:naml = Core-5 + Ferîd Vecdî (83). Mustafa Sabri tefsir korpusunda yok.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

process.env.SIMILARITY_MODE = "live";
process.env.DEDUP_CHUNKS = "true";
process.env.CHUNK_TEXT_MODE = "parent";
process.env.STRICT_VECTOR = "true";

const { performSimilaritySearch, createQueryEmbedding } = await import("../src/utils/similarity-search.js");
const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = await import("../src/embedding-constants.js");
const { generateTafsirNonStreaming } = await import("../src/utils/openai.js");
const { buildTafsirPrompt } = await import("../src/utils/prompt.js");
const {
  loadCitations,
  analyzeScholarGroup,
  buildSourceExcerpts,
} = await import("../src/routes/tafseer.js");

const prisma = new PrismaClient();

// ── Preset → scholarIds ────────────────────────────────────────────────────
// Mustafa Sabri (extended:naml) korpusta yok — Appendix B'de beyan edilecek.
const SCHOLAR_PRESETS: Record<string, number[] | null> = {
  core5:           [7, 19, 22, 24, 29],
  allN:            null,
  "extended:naml": [7, 19, 22, 24, 29, 83],
  "extended:taha": [7, 19, 22, 24, 29, 9],
  "extended:nur":  [7, 19, 22, 24, 29, 55],
};

// ── Hücre tipi (generate-kite-cells.ts ile uyumlu) ───────────────────────
interface VerseRef {
  label: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
}
interface Cell {
  runId: string;
  cellId: string;
  verse: VerseRef;
  presetName: string;
  temperature: number;
  minSimilarity: number;
  limit: number;
  replication: number;
  isTestRun: true;
}
interface CellsBatch {
  batchId: string;
  cells: Cell[];
}

// ── Snapshot tipi ─────────────────────────────────────────────────────────
interface KiteSnapshot {
  runId: string;
  batchId: string;
  cellId: string;
  verse: VerseRef;
  presetName: string;
  scholarIds: number[] | null;
  temperature: number;
  seed: number;
  minSimilarity: number;
  replication: number;
  retrieved_all: Array<{
    tafsirId: string;
    scholarId: string;
    scholarName: string;
    similarityScore: number;
    chars: number;
    contentHash: string;
  }>;
  prompt_included: string[];
  promptVariant: "group" | "individual";
  promptHash: string;
  systemFingerprint: string | undefined;
  aiResponse: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  generatedAt: string;
  // ── Reproducibility snapshot'ı (v2) ──
  snapshotSchema: "v2";
  queryText: string;
  queryEmbeddingHash: string;
  corpus: { embeddingModel: string; embeddingDimensions: number; version: string };
  error?: string;
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────
function computePromptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

// İçerik hash'i — tafsirId serial PK olduğu için korpus reload'da yeniden atanır;
// commentary'nin sha256'sı içerikten birebir eşleme sağlar (full 64-hex, collision-safe).
function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function extractArabicTerms(text: string): string[] {
  const matches = text.match(/[؀-ۿ]+/g) || [];
  const meaningful = matches.filter((t) => t.length >= 3);
  return [...new Set(meaningful)].sort((a, b) => b.length - a.length).slice(0, 10);
}

async function loadCompletedRunIds(outputPath: string): Promise<Set<string>> {
  const done = new Set<string>();
  if (!existsSync(outputPath)) return done;
  const lines = readFileSync(outputPath, "utf-8").trim().split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const snap = JSON.parse(line) as { runId?: string };
      if (snap.runId) done.add(snap.runId);
    } catch { /* bozuk satır — atla */ }
  }
  return done;
}

// ── Ana orkestratör ────────────────────────────────────────────────────────
async function runCell(cell: Cell, batchId: string, outputPath: string): Promise<void> {
  const isRange = cell.verse.ayahStart !== cell.verse.ayahEnd;
  const scholarIds = SCHOLAR_PRESETS[cell.presetName] ?? null;

  // 1. Ayet metinleri — DB'den, saf arabicText (production parity)
  const verseRows = await prisma.verse.findMany({
    where: {
      surahNumber: cell.verse.surah,
      verseNumber: { gte: cell.verse.ayahStart, lte: cell.verse.ayahEnd },
    },
    select: { id: true, arabicText: true, translation: true, verseNumber: true },
    orderBy: { verseNumber: "asc" },
  });
  if (verseRows.length === 0) throw new Error(`Ayet bulunamadı: ${cell.verse.label}`);

  const searchQuery = isRange
    ? verseRows.map((v) => v.arabicText).join(" ").trim()
    : verseRows[0].arabicText;

  const verseIds = verseRows.map((v) => v.id);
  const anchorVerse = verseRows[0];

  // 2. Sorgu embedding'i — bir kez hesaplanır, hem retrieval'a geçirilir hem
  //    snapshot'a yazılır (saklanan vektör = retrieval'da kullanılan vektör, drift yok).
  const queryEmbedding = await createQueryEmbedding(searchQuery);
  const queryEmbeddingHash = computeContentHash(queryEmbedding.join(","));

  // 3. Retrieval (STRICT_VECTOR=true — hata fırlatır, fallback yok)
  const rawResults = await performSimilaritySearch(prisma, {
    query: searchQuery,
    queryEmbedding,
    verseIds,
    scholarIds: scholarIds?.map(String),
    limit: cell.limit,
    minSimilarity: cell.minSimilarity,
  });

  // Tam sorgu vektörü sidecar'a — ana JSONL'i şişirmeden birebir yeniden koşum kaynağı.
  const queryEmbPath = outputPath.replace(/\.jsonl$/, "") + ".query-embeddings.jsonl";
  appendFileSync(
    queryEmbPath,
    JSON.stringify({ runId: cell.runId, queryText: searchQuery, queryEmbeddingHash, embedding: queryEmbedding }) + "\n",
    "utf-8",
  );

  // 3. Prompt zinciri (tafseer.ts:941-1003 ile birebir)
  const citations = await loadCitations(prisma, rawResults);
  const scholarAnalysis = analyzeScholarGroup(rawResults);
  const keyArabicTerms = [...new Set(
    rawResults.flatMap((t) => extractArabicTerms(t.tafsirText)),
  )].slice(0, 15);

  const sliceLimit = isRange ? Math.min(verseRows.length * 3, 15) : 5;
  const promptOptions = {
    verseText: anchorVerse.arabicText,
    // translation = ayah_text_tr (Arapça + Latin künye) — production parity.
    // Appendix B'de beyan: "Retrieved separately from arabicText; prompt'a ikinci defa girer."
    translation: anchorVerse.translation || undefined,
    verses: isRange
      ? verseRows.map((v) => ({
          verseNumber: v.verseNumber,
          arabicText: v.arabicText,
          translation: v.translation ?? undefined,
        }))
      : undefined,
    tafsirExcerpts: rawResults.slice(0, sliceLimit).map((r) => ({
      scholar: {
        name: r.mufassir.name,
        century: r.mufassir.century,
        madhab: r.mufassir.madhab || undefined,
        period: r.mufassir.period || undefined,
        environment: r.mufassir.environment || undefined,
        originCountry: r.mufassir.originCountry || undefined,
        reputationScore: r.mufassir.reputationScore || undefined,
      },
      // 500-char kırpma: production parity (tafseer.ts:987-989)
      // Appendix B: "generation'a head-of-commentary girer; küllî katman sonra kalır."
      excerpt: r.tafsirText.length > 500
        ? r.tafsirText.substring(0, 500) + "..."
        : r.tafsirText,
    })),
    citations: citations.slice(0, 8).map((c) => ({
      scholarName: c.scholarName,
      sourceTitle: c.sourceTitle,
      sourceType: c.sourceType,
      volume: c.volume,
      page: c.page,
    })),
    arabicTerms: keyArabicTerms,
    userParams: { language: "Turkish" },
    scholarAnalysis,
  };

  // 4. Generation (seed=replication, temperature=hücre değeri)
  const fullPrompt = buildTafsirPrompt(promptOptions);
  const result = await generateTafsirNonStreaming({
    promptOptions,
    temperature: cell.temperature,
    seed: cell.replication,   // rep 1/2/3 → seed 1/2/3; fingerprint koşular arası karşılaştırılır
    maxTokens: 800,           // lengthScale=6 default (tafseer.ts:1275-1276)
  });

  // 5. Snapshot — tüm analiz alanlarıyla
  const snap: KiteSnapshot = {
    runId: cell.runId,
    batchId,
    cellId: cell.cellId,
    verse: cell.verse,
    presetName: cell.presetName,
    scholarIds,
    temperature: cell.temperature,
    seed: cell.replication,
    minSimilarity: cell.minSimilarity,
    replication: cell.replication,
    retrieved_all: rawResults.map((r) => ({
      tafsirId: r.tafsirId,
      scholarId: r.scholar.id,
      scholarName: r.scholarName,
      similarityScore: r.similarityScore,
      chars: r.tafsirText.length,
      contentHash: computeContentHash(r.tafsirText),
    })),
    prompt_included: promptOptions.tafsirExcerpts.map((e) => e.scholar.name),
    promptVariant: scholarAnalysis.totalScholars > 3 ? "group" : "individual",
    promptHash: computePromptHash(fullPrompt),
    systemFingerprint: result.systemFingerprint,
    aiResponse: result.content,
    usage: result.usage,
    generatedAt: new Date().toISOString(),
    snapshotSchema: "v2",
    queryText: searchQuery,
    queryEmbeddingHash,
    corpus: {
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      version: process.env.CORPUS_VERSION ?? "unset",
    },
  };

  appendFileSync(outputPath, JSON.stringify(snap) + "\n", "utf-8");
}

async function main() {
  const cellsPath = process.argv[2] ?? resolve(__dirname, "../../../cells.json");
  const outputPath = process.argv[3] ?? resolve(__dirname, "../../../kite-results.jsonl");

  if (!existsSync(cellsPath)) {
    console.error(`❌ cells.json bulunamadı: ${cellsPath}`);
    console.error("   Önce: npx tsx scripts/generate-kite-cells.ts");
    process.exit(1);
  }

  const batch = JSON.parse(readFileSync(cellsPath, "utf-8")) as CellsBatch;
  const cells: Cell[] = batch.cells;
  const batchId = batch.batchId;

  if (cells.length !== 63 && !batchId.startsWith("dry-run") && !batchId.startsWith("mini-batch") && !batchId.startsWith("probe")) {
    console.error(`❌ Beklenen 63 hücre, bulunan ${cells.length}. cells.json bozuk.`);
    process.exit(1);
  }

  const done = await loadCompletedRunIds(outputPath);
  const remaining = cells.filter((c) => !done.has(c.runId));

  console.log(`\nKITE Harness — batchId: ${batchId}`);
  console.log(`Toplam: ${cells.length} | Tamamlanan: ${done.size} | Kalan: ${remaining.length}`);
  console.log(`Çıktı: ${outputPath}\n`);

  if (remaining.length === 0) {
    console.log("✅ Tüm hücreler tamamlandı.");
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const cell of remaining) {
    const start = Date.now();
    process.stdout.write(`[${done.size + successCount + 1}/63] ${cell.runId} ... `);

    try {
      await runCell(cell, batchId, outputPath);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ ${elapsed}s`);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ HATA: ${msg}`);
      errorCount++;

      // STRICT: geçici API hatası (429/5xx) → dur, döküm kaydedildi.
      // Kalıcı hata (model, prompt) → devam et ama kayıt bırak.
      if (msg.includes("429") || msg.includes("503") || msg.includes("502")) {
        console.error("\n⛔ Rate-limit/servis hatası — duruluyor. Kaldığı yerden devam için tekrar çalıştır.");
        break;
      }

      // Kalıcı hata: snapshot'a error alanıyla yaz, devam et
      const errSnap = {
        runId: cell.runId,
        batchId,
        cellId: cell.cellId,
        verse: cell.verse,
        presetName: cell.presetName,
        temperature: cell.temperature,
        seed: cell.replication,
        minSimilarity: cell.minSimilarity,
        replication: cell.replication,
        error: msg,
        generatedAt: new Date().toISOString(),
      };
      appendFileSync(outputPath, JSON.stringify(errSnap) + "\n", "utf-8");
    }
  }

  console.log(`\nTamamlandı: ✅ ${successCount}  ❌ ${errorCount}`);
  console.log(`Çıktı: ${outputPath}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
