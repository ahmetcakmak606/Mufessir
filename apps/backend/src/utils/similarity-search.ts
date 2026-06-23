import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./embedding-config.js";

const aiDisabled = process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";
const openai = process.env.OPENAI_API_KEY && !aiDisabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface SimilaritySearchOptions {
  query: string;
  limit?: number;
  verseId?: string;
  verseIds?: string[];
  scholarIds?: string[];
  excludeScholarIds?: string[];
  minSimilarity?: number;
  methodTags?: string[];
  rangeFilter?: { surahNumber: number; startVerse: number; endVerse: number };
}

export interface SimilaritySearchResult {
  tafsirId: string;
  scholarName: string;
  tafsirText: string;
  similarityScore: number;
  verseId: string;
  surahNumber: number;
  verseNumber: number;
  scholar: {
    id: string;
    name: string;
    century: number;
    madhab: string | null;
    period: string | null;
    environment: string | null;
    originCountry: string | null;
    reputationScore: number | null;
  };
}

export async function createQueryEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error(aiDisabled ? "OpenAI disabled by environment" : "OpenAI API key not configured");
  }
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const embedding = (response as any).data?.[0]?.embedding as number[] | undefined;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

async function runSampleSearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions,
  limit: number,
): Promise<Array<SimilaritySearchResult & { mufassir: any }>> {
  const { rangeFilter } = options;
  const verseIds = options.verseIds?.length
    ? options.verseIds
    : options.verseId
      ? [options.verseId]
      : [];
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  let ayahMapFilter = "";
  if (rangeFilter) {
    ayahMapFilter = `WHERE surah_id = $${idx} AND ayah_number >= $${idx + 1} AND ayah_number <= $${idx + 2}`;
    params.push(rangeFilter.surahNumber, rangeFilter.startVerse, rangeFilter.endVerse);
    idx += 3;
  } else if (verseIds.length > 0) {
    conditions.push(`t.verse_id = ANY($${idx}::text[])`);
    params.push(verseIds);
    idx += 1;
  }

  if (options.scholarIds && options.scholarIds.length > 0) {
    conditions.push(`t.mufassir_id = ANY($${idx}::int[])`);
    params.push(options.scholarIds.map(Number));
    idx += 1;
  }
  if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
    conditions.push(`NOT (t.mufassir_id = ANY($${idx}::int[]))`);
    params.push(options.excludeScholarIds.map(Number));
    idx += 1;
  }
  if (options.methodTags && options.methodTags.length > 0) {
    conditions.push(`COALESCE(t."methodTags", ARRAY[]::text[]) && $${idx}::text[]`);
    params.push(options.methodTags);
    idx += 1;
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    WITH ayah_map AS (
      SELECT
        id,
        surah_id,
        ayah_number,
        ROW_NUMBER() OVER (ORDER BY surah_id ASC, ayah_number ASC)::text AS legacy_id,
        ('verse-' || surah_id::text || '-' || ayah_number::text) AS composite_id,
        (surah_id::text || ':' || ayah_number::text) AS colon_id,
        (surah_id::text || '-' || ayah_number::text) AS dash_id
      FROM ayahs
      ${ayahMapFilter}
    )
    SELECT
      t.id::text AS tafsir_id,
      t.verse_id AS verse_id,
      t.commentary AS tafsir_text,
      v.surah_id AS surah_number,
      v.ayah_number AS verse_number,
      m.mufassir_id::text AS scholar_id,
      COALESCE(m.mufassir_en, m.mufassir_tr, m.mufassir_ar, 'Unknown') AS scholar_name,
      m.century,
      m.madhab,
      m.period,
      m.environment,
      m.origin_country,
      m.reputation_score
    FROM all_tafsirs t
    JOIN mufassirs m ON m.mufassir_id = t.mufassir_id
    JOIN ayah_map v
      ON t.verse_id = v.id
      OR t.verse_id = v.legacy_id
      OR t.verse_id = v.composite_id
      OR t.verse_id = v.colon_id
      OR t.verse_id = v.dash_id
    ${whereSql}
    ORDER BY t.id ASC
    LIMIT $${idx}
  `;
  params.push(limit);
  const rows = (await prisma.$queryRawUnsafe(query, ...params)) as Array<Record<string, any>>;
  return rows.map((row) => ({
    tafsirId: String(row.tafsir_id),
    scholarName: String(row.scholar_name),
    tafsirText: String(row.tafsir_text || ""),
    similarityScore: 0.8,
    verseId: String(row.verse_id),
    surahNumber: Number(row.surah_number),
    verseNumber: Number(row.verse_number),
    scholar: {
      id: String(row.scholar_id),
      name: String(row.scholar_name),
      century: Number(row.century || 0),
      madhab: row.madhab ?? null,
      period: row.period ?? null,
      environment: row.environment ?? null,
      originCountry: row.origin_country ?? null,
      reputationScore: row.reputation_score ?? null,
    },
    mufassir: {
      id: String(row.scholar_id),
      name: String(row.scholar_name),
      century: Number(row.century || 0),
      madhab: row.madhab ?? null,
      period: row.period ?? null,
      environment: row.environment ?? null,
      originCountry: row.origin_country ?? null,
      reputationScore: row.reputation_score ?? null,
    },
  }));
}

/**
 * Vektör retrieval — dedup'lı.
 *   DEDUP_CHUNKS    : "true" (default) | "false" (legacy tek-tablo, robustness karşı-olgusu)
 *   CHUNK_TEXT_MODE : "chunk" (default, en yakın chunk metni) | "parent" (tam şerh, all_tafsirs.commentary)
 *   STRICT_VECTOR   : "true" → vektör hatası sessizce yutulmaz, throw edilir (deney/harness modu).
 *                     Üretimde false bırak (fallback kullanıcıya boş ekran göstermez).
 *
 * Alias'lar TIRNAKLANDI (tafsirId vs.) — tırnaksız olsaydı Postgres küçültür, JS res.tafsirId undefined alırdı.
 */
export async function performSimilaritySearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions,
): Promise<SimilaritySearchResult[]> {
  const limit = options.limit ?? 10;
  const strictVector = process.env.STRICT_VECTOR === "true";

  if (process.env.SIMILARITY_MODE === "sample" || !openai) {
    if (strictVector) {
      throw new Error(
        `STRICT_VECTOR: vektör yolu kullanılamıyor — SIMILARITY_MODE=${process.env.SIMILARITY_MODE ?? "unset"}, openai=${openai ? "ok" : "null (API key eksik?)"}`,
      );
    }
    return runSampleSearch(prisma, options, limit);
  }

  const dedupEnabled = (process.env.DEDUP_CHUNKS ?? "true") !== "false";
  const textMode = (process.env.CHUNK_TEXT_MODE ?? "chunk") === "parent" ? "parent" : "chunk";

  try {
    const sampleTafsirs = await runSampleSearch(prisma, options, limit);
    if (sampleTafsirs.length === 0) return [];

    const queryEmbedding = await createQueryEmbedding(options.query);
    const vectorLiteral = "[" + queryEmbedding.join(",") + "]";
    const { rangeFilter } = options;
    const verseIds = options.verseIds?.length
      ? options.verseIds
      : options.verseId
        ? [options.verseId]
        : [];

    const params: unknown[] = [vectorLiteral];
    let idx = 2;

    let ayahMapFilter = "";
    if (rangeFilter) {
      ayahMapFilter = `WHERE surah_id = $${idx} AND ayah_number >= $${idx + 1} AND ayah_number <= $${idx + 2}`;
      params.push(rangeFilter.surahNumber, rangeFilter.startVerse, rangeFilter.endVerse);
      idx += 3;
    }

    const condsT: string[] = ["t.embedding IS NOT NULL"];
    const condsC: string[] = ["c.embedding IS NOT NULL"];
    let needParentJoin = false;

    if (!rangeFilter && verseIds.length > 0) {
      condsT.push(`t.verse_id = ANY($${idx}::text[])`);
      condsC.push(`c.verse_id = ANY($${idx}::text[])`);
      params.push(verseIds);
      idx += 1;
    }
    if (options.scholarIds && options.scholarIds.length > 0) {
      condsT.push(`t.mufassir_id = ANY($${idx}::int[])`);
      condsC.push(`c.mufassir_id = ANY($${idx}::int[])`);
      params.push(options.scholarIds.map(Number));
      idx += 1;
    }
    if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
      condsT.push(`NOT (t.mufassir_id = ANY($${idx}::int[]))`);
      condsC.push(`NOT (c.mufassir_id = ANY($${idx}::int[]))`);
      params.push(options.excludeScholarIds.map(Number));
      idx += 1;
    }
    if (options.methodTags && options.methodTags.length > 0) {
      condsT.push(`COALESCE(t."methodTags", ARRAY[]::text[]) && $${idx}::text[]`);
      condsC.push(`COALESCE(p."methodTags", ARRAY[]::text[]) && $${idx}::text[]`);
      params.push(options.methodTags);
      idx += 1;
      needParentJoin = true;
    }
    const whereSqlT = condsT.join(" AND ");
    const whereSqlC = condsC.join(" AND ");

    const ayahMapCte = `
      ayah_map AS (
        SELECT
          id,
          surah_id AS surah_number,
          ayah_number,
          ROW_NUMBER() OVER (ORDER BY surah_id ASC, ayah_number ASC)::text AS legacy_id,
          ('verse-' || surah_id::text || '-' || ayah_number::text) AS composite_id,
          (surah_id::text || ':' || ayah_number::text) AS colon_id,
          (surah_id::text || '-' || ayah_number::text) AS dash_id
        FROM ayahs
        ${ayahMapFilter}
      )`;

    const joinAyahMap = (alias: string) => `
      JOIN ayah_map v
        ON ${alias}.verse_id = v.id
        OR ${alias}.verse_id = v.legacy_id
        OR ${alias}.verse_id = v.composite_id
        OR ${alias}.verse_id = v.colon_id
        OR ${alias}.verse_id = v.dash_id`;

    let query: string;

    if (dedupEnabled) {
      query = `
        WITH ${ayahMapCte},
        hits AS (
          SELECT
            t.id          AS tafsir_id,
            t.mufassir_id AS mufassir_id,
            t.verse_id    AS verse_id,
            t.commentary  AS hit_text,
            v.surah_number,
            v.ayah_number,
            (t.embedding <=> $1::vector) AS dist
          FROM all_tafsirs t
          ${joinAyahMap("t")}
          WHERE ${whereSqlT}
          UNION ALL
          SELECT
            c.parent_id   AS tafsir_id,
            c.mufassir_id AS mufassir_id,
            c.verse_id    AS verse_id,
            c.commentary  AS hit_text,
            v.surah_number,
            v.ayah_number,
            (c.embedding <=> $1::vector) AS dist
          FROM tafsir_chunks c
          ${needParentJoin ? "JOIN all_tafsirs p ON p.id = c.parent_id" : ""}
          ${joinAyahMap("c")}
          WHERE ${whereSqlC}
        ),
        dedup AS (
          SELECT DISTINCT ON (mufassir_id, verse_id)
            tafsir_id, mufassir_id, verse_id, hit_text, surah_number, ayah_number, dist
          FROM hits
          ORDER BY mufassir_id, verse_id, dist
        )
        SELECT
          d.tafsir_id::text AS "tafsirId",
          COALESCE(m.mufassir_en, m.mufassir_tr, m.mufassir_ar, 'Unknown') AS "scholarName",
          ${textMode === "parent" ? "pt.commentary" : "d.hit_text"} AS "tafsirText",
          1 - d.dist AS "similarityScore",
          d.verse_id AS "verseId",
          d.surah_number AS "surahNumber",
          d.ayah_number AS "verseNumber",
          m.mufassir_id AS "scholarId",
          m.century AS "century",
          m.madhab AS "madhab",
          m.period AS "period",
          m.environment AS "environment",
          m.origin_country AS "originCountry",
          m.reputation_score AS "reputationScore"
        FROM dedup d
        JOIN mufassirs m ON d.mufassir_id = m.mufassir_id
        ${textMode === "parent" ? "JOIN all_tafsirs pt ON pt.id = d.tafsir_id" : ""}
        ORDER BY d.dist
        LIMIT $${idx}
      `;
    } else {
      // LEGACY (dedup kapalı) — yalnız all_tafsirs; alias'lar burada da tırnaklı.
      query = `
        WITH ${ayahMapCte}
        SELECT
          t.id::text AS "tafsirId",
          COALESCE(m.mufassir_en, m.mufassir_tr, m.mufassir_ar, 'Unknown') AS "scholarName",
          t.commentary AS "tafsirText",
          1 - (t.embedding <=> $1::vector) AS "similarityScore",
          t.verse_id AS "verseId",
          v.surah_number AS "surahNumber",
          v.ayah_number AS "verseNumber",
          m.mufassir_id AS "scholarId",
          m.century AS "century",
          m.madhab AS "madhab",
          m.period AS "period",
          m.environment AS "environment",
          m.origin_country AS "originCountry",
          m.reputation_score AS "reputationScore"
        FROM all_tafsirs t
        JOIN mufassirs m ON t.mufassir_id = m.mufassir_id
        ${joinAyahMap("t")}
        WHERE ${whereSqlT}
        ORDER BY t.embedding <=> $1::vector
        LIMIT $${idx}
      `;
    }
    params.push(limit);

    const results = await prisma.$queryRawUnsafe(query, ...params);

    const vectorResults = (results as unknown[])
      .filter((r: unknown) => (r as any).similarityScore >= (options.minSimilarity ?? 0.5))
      .map((result: unknown) => {
        const res = result as Record<string, unknown>;
        // mufassir = scholar alias: route helpers (loadCitations, analyzeScholarGroup,
        // buildSourceExcerpts) erişiyor; kaynakta eşitlenir, hem production hem harness düzelir.
        const scholar = {
          id: String(res.scholarId),
          name: String(res.scholarName),
          century: Number(res.century),
          madhab: res.madhab as string | null,
          period: res.period as string | null,
          environment: res.environment as string | null,
          originCountry: res.originCountry as string | null,
          reputationScore: res.reputationScore as number | null,
        };
        return {
          tafsirId: String(res.tafsirId),
          scholarName: String(res.scholarName),
          tafsirText: String(res.tafsirText),
          similarityScore: Number(res.similarityScore),
          verseId: String(res.verseId),
          surahNumber: Number(res.surahNumber),
          verseNumber: Number(res.verseNumber),
          scholar,
          mufassir: scholar,
        };
      });
    return vectorResults.length > 0 ? vectorResults : sampleTafsirs;
  } catch (error) {
    if (strictVector) {
      // Deney modunda sessiz fallback yok — hatayı fırlat, sahte 0.8 skoru üretme.
      throw error;
    }
    console.error("Similarity search error:", error);
    return runSampleSearch(prisma, options, limit);
  }
}
