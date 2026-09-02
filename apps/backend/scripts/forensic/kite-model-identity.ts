#!/usr/bin/env node
/**
 * kite-model-identity.ts  — forensik test (OpenAI embedding çağrısı yapar)
 *
 * Tarih:  2026-09-02
 * Amaç:   Korpustaki (all_tafsirs) saklı vektörler HANGİ modelle üretildi?
 *         git tarihi ≤06-20 3-small, 06-21→ 3-large diyor; updated_at raw-UPDATE
 *         nedeniyle tarihlemiyor. Kesin test: aynı metni 3-small@1536 ve
 *         3-large@1536 ile yeniden göm, saklı vektörle kosinüsü karşılaştır.
 *
 * Yöntem: 5 satır (farklı ayet/uzunluk, hepsi Core-5, hepsi all_tafsirs-embedded).
 *   - commentary + saklı embedding all_tafsirs'ten çekilir
 *   - chars, artefakttaki (kite-results.jsonl retrieved_all) değerle doğrulanır;
 *     eşleşmeyen elenir (embedding'e sokulmaz)
 *   - 5 satır × 2 model = 10 kosinüs skorunun TAMAMI raporlanır
 *
 * Karar (yorumu kullanıcı yapar): bir model tutarlı ~1.0 → korpus o modelle.
 *   İkisi de 1.0'dan uzaksa → "üçüncü model veya metin değişti" (bir bulgudur).
 *
 * Çalıştır: npx tsx apps/backend/scripts/forensic/kite-model-identity.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../..");
config({ path: resolve(ROOT, ".env") });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// (verse_id dash, mufassir_id, artefakt label) — hepsi all_tafsirs-embedded (occupancy 2026-09-02)
const PICKS: Array<[string, number, string]> = [
  ["3-7", 19, "3:7"],    // Zamahşerî, 2673
  ["24-35", 29, "24:35"], // İbn Kesîr, 11110 (en uzun all_tafsirs-embedded)
  ["20-5", 29, "20:5"],   // İbn Kesîr, 324 (en kısa)
  ["20-5", 22, "20:5"],   // Râzî, 6545 (orta)
  ["24-35", 19, "24:35"], // Zamahşerî, 3379
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(text: string, model: string): Promise<number[]> {
  const r = await openai.embeddings.create({ model, input: text, dimensions: 1536 });
  return r.data[0].embedding;
}

function loadArtefactChars(): Map<string, number> {
  // key = `${label}|${scholarId}` -> chars (retrieved_all, parent-mode tam commentary uzunluğu)
  const m = new Map<string, number>();
  const p = resolve(ROOT, "kite-results.jsonl");
  for (const line of readFileSync(p, "utf-8").trim().split("\n")) {
    if (!line.trim()) continue;
    const s = JSON.parse(line);
    for (const r of s.retrieved_all ?? []) {
      m.set(`${s.verse.label}|${r.scholarId}`, r.chars);
    }
  }
  return m;
}

async function main() {
  const artefactChars = loadArtefactChars();
  const out: any[] = [];

  for (const [verseId, mid, label] of PICKS) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text AS id, length(commentary)::int AS chars, commentary, embedding::text AS emb
       FROM all_tafsirs WHERE verse_id = $1 AND mufassir_id = $2 AND embedding IS NOT NULL LIMIT 1`,
      verseId, mid,
    );
    if (rows.length === 0) { out.push({ ayet: label, mid, durum: "all_tafsirs-embedded satır yok — elendi" }); continue; }
    const row = rows[0];
    const artChars = artefactChars.get(`${label}|${String(mid)}`);
    const charsMatch = artChars === undefined ? "artefakt yok" : (artChars === row.chars ? "EŞLEŞTİ" : `UYUŞMUYOR(art=${artChars})`);

    if (artChars !== undefined && artChars !== row.chars) {
      out.push({ ayet: label, mid, tafsirId: row.id, db_chars: row.chars, art_chars: artChars, durum: "chars UYUŞMUYOR — elendi" });
      continue;
    }

    const stored = JSON.parse(row.emb) as number[];
    const [vSmall, vLarge] = await Promise.all([
      embed(row.commentary, "text-embedding-3-small"),
      embed(row.commentary, "text-embedding-3-large"),
    ]);

    out.push({
      ayet: label, mid, tafsirId: row.id, db_chars: row.chars, chars_kontrol: charsMatch,
      dim_stored: stored.length,
      cos_3small: Number(cosine(stored, vSmall).toFixed(6)),
      cos_3large: Number(cosine(stored, vLarge).toFixed(6)),
    });
  }

  console.log("\n=== Model kimliği: saklı vektör ↔ yeniden gömme kosinüsleri (5 satır × 2 model = 10 skor) ===");
  console.table(out);
  await prisma.$disconnect();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
