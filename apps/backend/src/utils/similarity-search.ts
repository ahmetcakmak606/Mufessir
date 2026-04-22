import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

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
  const response = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  const embedding = (response as any).data?.[0]?.embedding as number[] | undefined;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

function mapTafsirResult(tafsir: any): SimilaritySearchResult & { mufassir: any } {
  const name =
    tafsir.mufassir.nameEn || tafsir.mufassir.nameTr || tafsir.mufassir.nameAr;
  const shortName = tafsir.mufassir.nameEn || tafsir.mufassir.nameTr;
  return {
    tafsirId: tafsir.id,
    scholarName: name,
    tafsirText: tafsir.tafsirText,
    similarityScore: 0.8,
    verseId: tafsir.verseId,
    surahNumber: tafsir.verse.surahNumber,
    verseNumber: tafsir.verse.verseNumber,
    scholar: {
      id: String(tafsir.mufassir.id),
      name: shortName,
      century: tafsir.mufassir.century,
      madhab: tafsir.mufassir.madhab,
      period: tafsir.mufassir.period,
      environment: tafsir.mufassir.environment,
      originCountry: tafsir.mufassir.originCountry,
      reputationScore: tafsir.mufassir.reputationScore,
    },
    mufassir: {
      id: String(tafsir.mufassir.id),
      name,
      century: tafsir.mufassir.century,
      madhab: tafsir.mufassir.madhab,
      period: tafsir.mufassir.period,
      environment: tafsir.mufassir.environment,
      originCountry: tafsir.mufassir.originCountry,
      reputationScore: tafsir.mufassir.reputationScore,
    },
  };
}

async function runSampleSearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions,
  limit: number,
): Promise<Array<SimilaritySearchResult & { mufassir: any }>> {
  const verseIds = options.verseIds?.length
    ? options.verseIds
    : options.verseId
      ? [options.verseId]
      : [];
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (verseIds.length > 0) {
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
    conditions.push(`COALESCE(t.method_tags, ARRAY[]::text[]) && $${idx}::text[]`);
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

export async function performSimilaritySearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions,
): Promise<SimilaritySearchResult[]> {
  const limit = options.limit || 10;

  if (process.env.SIMILARITY_MODE === "sample" || !openai) {
    return runSampleSearch(prisma, options, limit);
  }

  try {
    const sampleTafsirs = await runSampleSearch(prisma, options, limit);
    if (sampleTafsirs.length === 0) return [];

    const queryEmbedding = await createQueryEmbedding(options.query);
    const vectorLiteral = "[" + queryEmbedding.join(",") + "]";

    const query = `
      WITH ayah_map AS (
        SELECT
          id,
          surah_id AS surah_number,
          ayah_number,
          ('verse-' || surah_id::text || '-' || ayah_number::text) AS composite_id,
          (surah_id::text || ':' || ayah_number::text) AS colon_id,
          (surah_id::text || '-' || ayah_number::text) AS dash_id
        FROM ayahs
      )
      SELECT
        t.id as tafsirId,
        m.name_en as scholarName,
        t.tafsir_text as tafsirText,
        1 - (t.embedding <=> $1::vector) as similarityScore,
        t.verse_id as verseId,
        v.surah_number as surahNumber,
        v.ayah_number as verseNumber,
        m.mufassir_id as scholarId,
        m.century,
        m.madhab,
        m.period,
        m.environment,
        m.origin_country as originCountry,
        m.reputation_score as reputationScore
      FROM all_tafsirs t
      JOIN mufassirs m ON t.mufassir_id = m.mufassir_id
      JOIN ayah_map v
        ON t.verse_id = v.id
        OR t.verse_id = v.composite_id
        OR t.verse_id = v.colon_id
        OR t.verse_id = v.dash_id
      WHERE t.embedding IS NOT NULL
      ORDER BY t.embedding <=> $1::vector
      LIMIT $2
    `;

    const results = await prisma.$queryRawUnsafe(query, vectorLiteral, limit);

    return (results as unknown[]).filter((r: unknown) => (r as any).similarityScore >= (options.minSimilarity || 0.5)).map((result: unknown) => {
      const res = result as Record<string, unknown>;
      return {
        tafsirId: String(res.tafsirId),
        scholarName: String(res.scholarName),
        tafsirText: String(res.tafsirText),
        similarityScore: Number(res.similarityScore),
        verseId: String(res.verseId),
        surahNumber: Number(res.surahNumber),
        verseNumber: Number(res.verseNumber),
        scholar: {
          id: String(res.scholarId),
          name: String(res.scholarName),
          century: Number(res.century),
          madhab: res.madhab as string | null,
          period: res.period as string | null,
          environment: res.environment as string | null,
          originCountry: res.originCountry as string | null,
          reputationScore: res.reputationScore as number | null,
        },
      };
    });
  } catch (error) {
    console.error("Similarity search error:", error);
    return runSampleSearch(prisma, options, limit);
  }
}
