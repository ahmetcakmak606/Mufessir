#!/usr/bin/env node
/**
 * kite-runtime-bridge.ts — READ-ONLY (DB'ye yazma yok; OpenAI embedding çağrısı yapar)
 *
 * Tarih: 2026-09-03
 * Amaç:  Kayıtlı erişim skorunu (retrieved_all.similarityScore) bugünkü belge
 *        vektörü + yeniden gömülen sorgu ile yeniden üretebiliyor muyuz?
 *        Üretebiliyorsak o satır için: (i) koşum-anı sorgu modeli 3-large,
 *        (ii) belge vektörü koşumdan beri değişmemiş — tek hamlede kanıtlanır.
 *
 * Kapsam: yalnız BÜTÜN-satır (all_tafsirs.embedding NOT NULL, chunk YOK).
 *   Chunk'lı satırlar DISTINCT ON hangi chunk'ı seçtiğini kaydetmediği için
 *   köprülenemez → sınır olarak beyan edilir, sayıma alınmaz.
 *
 * Adım 0 (sorgu string'i KODDAN): run-kite-harness.ts:
 *   single: verseRows[0].arabicText           (Verse.arabicText = ayahs.ayah_text_ar, HAM, trim YOK)
 *   range : verseRows.map(v=>v.arabicText).join(" ").trim()
 *   Bağımsız metin YAZILMAZ; ayahs'tan aynı alan çekilir.
 *
 * Pozitif kontrol (önce v2): kite-v2ctrl.jsonl queryText + sidecar tam vektör.
 *   - exact = cosSim(sidecar_vektör, docVec) → kayıtlı skorla ~0 fark beklenir
 *     (aynı vektör → belge vektörü değişmemiş + deterministik boru hattı).
 *   - repro = cosSim(embed_now(queryText), docVec) → query-side jitter.
 *   - tolerance = 2 × (v2 kontrolünde gözlenen max |kayıtlı - repro|).
 *
 * Read-only. Çalıştır: npx tsx apps/backend/scripts/forensic/kite-runtime-bridge.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../..");
config({ path: resolve(ROOT, ".env") });

const { createQueryEmbedding } = await import("../../src/utils/similarity-search.js");
const prisma = new PrismaClient();

function cosSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function readJsonl(p: string): any[] {
  return readFileSync(p, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Adım 0: label ("20:5" | "27:18-19") → koşum sorgu string'i (ayahs.ayah_text_ar)
async function buildQuery(label: string): Promise<string> {
  const [surahStr, rest] = label.split(":");
  const surah = Number(surahStr);
  const isRange = rest.includes("-");
  const [a0, a1] = isRange ? rest.split("-").map(Number) : [Number(rest), Number(rest)];
  const rows = await prisma.$queryRawUnsafe<{ ayah_text_ar: string }[]>(
    `SELECT ayah_text_ar FROM ayahs WHERE surah_id=$1 AND ayah_number>=$2 AND ayah_number<=$3 ORDER BY ayah_number ASC`,
    surah, a0, a1,
  );
  return isRange ? rows.map((r) => r.ayah_text_ar).join(" ").trim() : rows[0].ayah_text_ar;
}

// tafsirId'ler için belge vektörü + bütün-satır durumu + chars
async function loadDocs(ids: number[]) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT t.id::int AS id, char_length(t.commentary)::int AS chars,
            (t.embedding IS NOT NULL) AS has_emb,
            EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id) AS has_chunk,
            t.embedding::text AS emb
     FROM all_tafsirs t WHERE t.id = ANY($1::int[])`,
    ids,
  );
  const m = new Map<number, any>();
  for (const r of rows) m.set(r.id, r);
  return m;
}

async function main() {
  const embCache = new Map<string, number[]>();
  const embedOnce = async (q: string) => {
    if (!embCache.has(q)) embCache.set(q, await createQueryEmbedding(q));
    return embCache.get(q)!;
  };

  // ── POZİTİF KONTROL (v2) ───────────────────────────────────────────────
  console.log("═══ POZİTİF KONTROL (v2: queryText + sidecar biliniyor) ═══");
  const v2 = readJsonl(resolve(ROOT, "kite-v2ctrl.jsonl"))[0];
  const sidecar = readJsonl(resolve(ROOT, "kite-v2ctrl.query-embeddings.jsonl"))
    .find((s) => s.runId === v2.runId);
  const v2docs = await loadDocs(v2.retrieved_all.map((r: any) => Number(r.tafsirId)));
  const qUsed = sidecar.embedding as number[];
  // OpenAI sorgu-embedding'i run-to-run deterministik DEĞİL → queryText'i K kez göm,
  // jitter dağılımının maksimumundan tolerance türet (tek atışa bağlı kalma).
  const K = 5;
  const qTrials: number[][] = [];
  for (let k = 0; k < K; k++) qTrials.push(await createQueryEmbedding(v2.queryText));

  let v2maxJitter = 0;
  const v2rows = v2.retrieved_all.map((r: any) => {
    const doc = v2docs.get(Number(r.tafsirId));
    const docVec = JSON.parse(doc.emb) as number[];
    const exact = cosSim(qUsed, docVec);
    const reproT = qTrials.map((q) => cosSim(q, docVec));
    const jitterT = reproT.map((s) => Math.abs(r.similarityScore - s));
    const jMax = Math.max(...jitterT);
    v2maxJitter = Math.max(v2maxJitter, jMax);
    return {
      scholar: r.scholarName, kayitli: +r.similarityScore.toFixed(10),
      exact_sidecar: +exact.toFixed(10),
      "|kayitli-exact|": +Math.abs(r.similarityScore - exact).toExponential(2),
      "reembed_jitter_min": +Math.min(...jitterT).toExponential(2),
      "reembed_jitter_max": +jMax.toExponential(2),
    };
  });
  console.table(v2rows);
  const TOL = 2 * v2maxJitter;
  console.log(`v2 max query-jitter (K=${K} trial) = ${v2maxJitter.toExponential(3)}  →  TOLERANCE = 2× = ${TOL.toExponential(3)}`);
  console.log(`(exact_sidecar ↔ kayitli farkı = pgvector↔JS sayısal tabanı; re-embed jitter = OpenAI sorgu nondeterminizmi)`);

  // ── v1 KÖPRÜ (bütün-satır) ─────────────────────────────────────────────
  console.log("\n═══ v1 KÖPRÜ (kite-results.jsonl, yalnız bütün-satır) ═══");
  const v1 = readJsonl(resolve(ROOT, "kite-results.jsonl"));
  // (label, tafsirId) → {scholar, chars, storedScores[]}
  const cand = new Map<string, any>();
  for (const s of v1) {
    for (const r of s.retrieved_all ?? []) {
      const key = `${s.verse.label}::${r.tafsirId}`;
      if (!cand.has(key)) cand.set(key, { label: s.verse.label, tafsirId: Number(r.tafsirId), scholar: r.scholarName, chars: r.chars, stored: [] });
      cand.get(key).stored.push(r.similarityScore);
    }
  }
  const docs = await loadDocs([...cand.values()].map((c) => c.tafsirId));

  const out: any[] = [];
  const raw: Array<{ diff: number; spread: number }> = [];
  let charsMismatch = 0, skippedNotWhole = 0;
  for (const c of cand.values()) {
    const doc = docs.get(c.tafsirId);
    if (!doc || !doc.has_emb || doc.has_chunk) { skippedNotWhole++; continue; } // kapsam dışı
    if (doc.chars !== c.chars) { charsMismatch++; out.push({ label: c.label, scholar: c.scholar, durum: `chars UYUŞMUYOR (db=${doc.chars}, art=${c.chars}) — çıkarıldı` }); continue; }
    const q = await buildQuery(c.label);
    const qVec = await embedOnce(q);
    const repro = cosSim(qVec, JSON.parse(doc.emb));
    const storedMean = c.stored.reduce((a: number, b: number) => a + b, 0) / c.stored.length;
    const spread = Math.max(...c.stored) - Math.min(...c.stored);
    const diff = Math.abs(storedMean - repro);
    out.push({
      label: c.label, scholar: c.scholar, chars: c.chars, n_run: c.stored.length,
      kayitli_ort: +storedMean.toFixed(8), v1_spread: +spread.toExponential(2),
      repro: +repro.toFixed(8), fark: +diff.toExponential(3),
      tolerans_ici: diff <= TOL,
    });
    raw.push({ diff, spread });
  }
  // 24:35 / İbn Kesîr aykırısını ayrı işaretle
  console.table(out);

  const scored = out.filter((r) => r.tolerans_ici !== undefined);
  const m = scored.filter((r) => r.tolerans_ici).length;
  const n = scored.length;
  console.log(`\nÖZET: n (uygun bütün-satır) = ${n} | m (tolerans içinde) = ${m}  →  m/n = ${m}/${n}`);
  console.log(`chars uyuşmayan (çıkarıldı) = ${charsMismatch} | kapsam-dışı (chunk'lı/embed yok, sayılmadı) = ${skippedNotWhole}`);
  console.log(`TOLERANCE = ${TOL.toExponential(3)} (v2 kontrolünden: 2× max jitter)`);

  // Ek ham istatistik (yorum yok): fark ölçeği ve 06-22 kendi jitter bandı
  const maxFark = Math.max(...raw.map((r) => r.diff));
  const within1e3 = raw.filter((r) => r.diff <= 1e-3).length;
  const withinSpread = raw.filter((r) => r.diff <= r.spread + TOL).length;
  const driftScale = raw.filter((r) => r.diff >= 0.05).length;
  console.log(`\n── ek ham istatistik ──`);
  console.log(`max fark (n=${n}) = ${maxFark.toExponential(3)}`);
  console.log(`fark ≤ 1e-3  : ${within1e3}/${n}`);
  console.log(`fark ≤ (satırın 06-22 v1_spread'i + TOL) : ${withinSpread}/${n}  (repro, o satırın koşum-günü run-to-run bandına düşüyor)`);
  console.log(`fark ≥ 0.05 (belge-vektörü-değişimi ölçeği) : ${driftScale}/${n}`);

  const ibnkesir = out.filter((r) => r.label === "24:35" && /Kathir/i.test(r.scholar || ""));
  console.log("\n── 24:35 / İbn Kesîr (bütün-satır aykırı) ayrı ──");
  console.table(ibnkesir);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
