#!/usr/bin/env node
/**
 * kite-coverage-provenance.ts  — READ-ONLY forensik sorgu
 *
 * Tarih: 2026-09-03
 * Amaç:  Bugünkü kısmi doluluk (~2637/389458 all_tafsirs embedded) koşum-sonrası
 *        bir DÜŞÜŞ mü, yoksa korpus HİÇ tam gömülmedi mi (yalnız deney ayetleri)?
 *
 *   Kanıt-1: embedded satırların DAĞILIMI. 2637 satır deney ayetlerine mi yığılı
 *            (→ hiç tam gömülmedi, düşüş yok), yoksa binlerce ayete mi yayılı
 *            (→ geniş koşum olmuş, sonra düşürülmüş)?
 *   Kanıt-2: deney ayetlerinin bugünkü kapsamı (parent VEYA chunk vektörü) —
 *            koşum-anı retrieved_all ile tutarlı mı (düşüş test verse'lerine
 *            dokunmuş mu)?
 *
 * NOT: updated_at embedding yazımına kör (raw $executeRaw UPDATE → @updatedAt
 *   tetiklenmez). Ama saklı vektörler 3-large (kanıtlandı) = 06-21 sonrası yazıldı;
 *   satır updated_at'i 06-12. Yani mevcut embeddingler post-run bir 06-12 restore'un
 *   ürünü OLAMAZ (o snapshot'ta 3-large yoktu). Bu betik dağılımı ölçer.
 *
 * Read-only. Çalıştır: npx tsx apps/backend/scripts/forensic/kite-coverage-provenance.ts
 */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../..");
config({ path: resolve(ROOT, ".env") });
const prisma = new PrismaClient();

// Deney ayet kümesi: 63-run + probe JSONL'lerindeki verse.{surah,ayahStart..End}
function loadExperimentVerses(): string[] {
  const set = new Set<string>();
  for (const fn of ["kite-results.jsonl", "kite-probe31-v2.jsonl", "kite-probe31.jsonl"]) {
    const p = resolve(ROOT, fn);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf-8").trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const v = JSON.parse(line).verse;
        if (!v) continue;
        for (let a = v.ayahStart; a <= v.ayahEnd; a++) set.add(`${v.surah}-${a}`);
      } catch { /* atla */ }
    }
  }
  return [...set].sort();
}

async function main() {
  const expVerses = loadExperimentVerses();
  console.log("Deney ayetleri (JSONL'lerden):", expVerses.join(", "), `(n=${expVerses.length})`);

  // GLOBAL: embedded satır dağılımı — kaç DISTINCT ayete yayılı?
  console.log("\n=== GLOBAL: all_tafsirs embedded dağılımı ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int         AS embedded_satir,
      COUNT(DISTINCT verse_id) FILTER (WHERE embedding IS NOT NULL)::int AS embedded_distinct_ayet,
      COUNT(DISTINCT verse_id)::int                              AS toplam_distinct_ayet
    FROM all_tafsirs
  `));

  // Embedded satırların deney-içi vs deney-dışı kırılımı
  console.log("\n=== embedded satırlar: deney ayetleri İÇİ vs DIŞI ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*) FILTER (WHERE embedding IS NOT NULL AND verse_id = ANY($1::text[]))::int AS deney_ici_embedded,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL AND NOT (verse_id = ANY($1::text[])))::int AS deney_disi_embedded,
      COUNT(DISTINCT verse_id) FILTER (WHERE embedding IS NOT NULL AND NOT (verse_id = ANY($1::text[])))::int AS deney_disi_ayet_sayisi
    FROM all_tafsirs
  `, expVerses));

  // Deney-DIŞI embedded varsa hangi ayetler (geniş koşum kalıntısı olur)
  console.log("\n=== deney-DIŞI embedded ayetler (varsa — geniş koşum izi) top 20 ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    SELECT verse_id, COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
    FROM all_tafsirs
    WHERE NOT (verse_id = ANY($1::text[])) AND embedding IS NOT NULL
    GROUP BY verse_id ORDER BY embedded DESC LIMIT 20
  `, expVerses));

  // Deney ayetlerinin bugünkü kapsamı: parent VEYA chunk vektörü (pool tam mı)
  console.log("\n=== deney ayetleri: bugünkü havuz kapsamı (parent|chunk) ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    SELECT t.verse_id AS ayet,
           COUNT(*)::int AS toplam_mufessir,
           COUNT(*) FILTER (WHERE t.embedding IS NOT NULL)::int AS parent_embedded,
           COUNT(*) FILTER (WHERE t.embedding IS NULL AND EXISTS
             (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL))::int AS chunk_ile_kapsanan,
           COUNT(*) FILTER (WHERE t.embedding IS NULL AND NOT EXISTS
             (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id AND c.embedding IS NOT NULL))::int AS vektorsuz
    FROM all_tafsirs t
    WHERE t.verse_id = ANY($1::text[])
    GROUP BY t.verse_id ORDER BY t.verse_id
  `, expVerses));

  // Surah dağılımı: embedded satırlar hangi surahlarda? "full sonra düşürülmüş" ise
  // tüm surahlara dağılır; "ileri-yönlü kısmi koşum" ise düşük surahlarda kesilir.
  console.log("\n=== embedded satırların surah dağılımı (top 15 surah) ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    SELECT split_part(verse_id,'-',1)::int AS surah,
           COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded,
           COUNT(*)::int AS toplam_satir
    FROM all_tafsirs
    GROUP BY surah HAVING COUNT(*) FILTER (WHERE embedding IS NOT NULL) > 0
    ORDER BY embedded DESC LIMIT 15
  `));

  console.log("\n=== embedded satırların surah kapsamı (min/max/adet) ===");
  console.table(await prisma.$queryRawUnsafe<any[]>(`
    WITH s AS (
      SELECT DISTINCT split_part(verse_id,'-',1)::int AS surah
      FROM all_tafsirs WHERE embedding IS NOT NULL
    )
    SELECT MIN(surah) AS min_surah, MAX(surah) AS max_surah, COUNT(*)::int AS embedded_surah_sayisi FROM s
  `));

  await prisma.$disconnect();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });
