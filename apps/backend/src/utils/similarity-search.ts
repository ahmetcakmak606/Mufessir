import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../embedding-constants.js";

const aiDisabled =
  process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";
const openai =
  process.env.OPENAI_API_KEY && !aiDisabled
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

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
    throw new Error(
      aiDisabled
        ? "OpenAI disabled by environment"
        : "OpenAI API key not configured",
    );
  }
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    input: text,
  });
  const embedding = (response as any).data?.[0]?.embedding as
    | number[]
    | undefined;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

function mapTafsirResult(tafsir: any): SimilaritySearchResult {
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
  };
}

export async function performSimilaritySearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions,
): Promise<SimilaritySearchResult[]> {
  const limit = options.limit || 10;
  const buildWhere = () => {
    const where: Record<string, unknown> = {};
    if (options.verseId) where.verseId = options.verseId;
    if (options.scholarIds && options.scholarIds.length > 0)
      where.mufassirId = { in: options.scholarIds.map(Number) };
    if (options.excludeScholarIds && options.excludeScholarIds.length > 0)
      where.mufassirId = { notIn: options.excludeScholarIds.map(Number) };
    if (options.methodTags && options.methodTags.length > 0)
      where.methodTags = { hasSome: options.methodTags };
    return where;
  };

  if (process.env.SIMILARITY_MODE === "sample" || !openai) {
    const sampleTafsirs = await prisma.tafsir.findMany({
      where: buildWhere(),
      include: { mufassir: true, verse: true },
      take: limit,
    });
    return sampleTafsirs.map(mapTafsirResult);
  }

  try {
    const sampleTafsirs = await prisma.tafsir.findMany({
      where: buildWhere(),
      include: { mufassir: true, verse: true },
      take: limit,
    });
    if (sampleTafsirs.length === 0) return [];

    const queryEmbedding = await createQueryEmbedding(options.query);
    const vectorLiteral = "[" + queryEmbedding.join(",") + "]";

    const dedupEnabled = process.env.DEDUP_CHUNKS !== "off";

    if (dedupEnabled) {
      const { rangeFilter } = options;
      const verseIds = options.verseIds?.length
        ? options.verseIds
        : options.verseId
          ? [options.verseId]
          : [];
      const conditions: string[] = [];
      const params: unknown[] = [vectorLiteral];
      let idx = 2;

      let ayahMapFilter = "";
      if (rangeFilter) {
        ayahMapFilter = `WHERE surah_id = $${idx} AND ayah_number >= $${idx + 1} AND ayah_number <= $${idx + 2}`;
        params.push(rangeFilter.surahNumber, rangeFilter.startVerse, rangeFilter.endVerse);
        idx += 3;
      } else if (verseIds.length > 0) {
        conditions.push(`cand.verse_id = ANY($${idx}::text[])`);
        params.push(verseIds);
        idx += 1;
      }

      if (options.scholarIds && options.scholarIds.length > 0) {
        conditions.push(`cand.mufassir_id = ANY($${idx}::int[])`);
        params.push(options.scholarIds.map(Number));
        idx += 1;
      }
      if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
        conditions.push(`NOT (cand.mufassir_id = ANY($${idx}::int[]))`);
        params.push(options.excludeScholarIds.map(Number));
        idx += 1;
      }
      if (options.methodTags && options.methodTags.length > 0) {
        conditions.push(
          `COALESCE(cand.method_tags, ARRAY[]::text[]) && $${idx}::text[]`,
        );
        params.push(options.methodTags);
        idx += 1;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
        WITH ayah_map AS (
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
        ),
        candidates AS (
          SELECT
            t.id::text AS source_id,
            t.mufassir_id,
            t.verse_id,
            t.commentary,
            t.embedding,
            t."methodTags" AS method_tags
          FROM all_tafsirs t
          WHERE t.embedding IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM tafsir_chunks c WHERE c.parent_id = t.id)
          UNION ALL
          SELECT
            c.parent_id::text AS source_id,
            c.mufassir_id,
            c.verse_id,
            c.commentary,
            c.embedding,
            p."methodTags" AS method_tags
          FROM tafsir_chunks c
          JOIN all_tafsirs p ON p.id = c.parent_id
          WHERE c.embedding IS NOT NULL
        )
        SELECT * FROM (
          SELECT DISTINCT ON (cand.mufassir_id, cand.verse_id)
            cand.source_id            AS "tafsirId",
            COALESCE(m.mufassir_en, m.mufassir_tr, m.mufassir_ar, 'Unknown') AS "scholarName",
            cand.commentary           AS "tafsirText",
            1 - (cand.embedding <=> $1::vector) AS "similarityScore",
            cand.verse_id             AS "verseId",
            v.surah_number            AS "surahNumber",
            v.ayah_number             AS "verseNumber",
            m.mufassir_id             AS "scholarId",
            m.century,
            m.madhab,
            m.period,
            m.environment,
            m.origin_country          AS "originCountry",
            m.reputation_score        AS "reputationScore"
          FROM candidates cand
          JOIN mufassirs m ON m.mufassir_id = cand.mufassir_id
          JOIN ayah_map v
            ON cand.verse_id = v.id
            OR cand.verse_id = v.legacy_id
            OR cand.verse_id = v.composite_id
            OR cand.verse_id = v.colon_id
            OR cand.verse_id = v.dash_id
          ${whereClause}
          ORDER BY cand.mufassir_id, cand.verse_id, cand.embedding <=> $1::vector
        ) dd
        ORDER BY dd."similarityScore" DESC
        LIMIT $${idx}
      `;
      params.push(limit);

      const results = await prisma.$queryRawUnsafe(query, ...params);

      return (results as unknown[])
        .filter(
          (r: unknown) =>
            (r as any).similarityScore >= (options.minSimilarity || 0.5),
        )
        .map((result: unknown) => {
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
    }

    const query =
      "SELECT t.id as tafsirId, m.name_en as scholarName, t.tafsir_text as tafsirText, 1 - (t.embedding <=> $1::vector) as similarityScore, t.verse_id as verseId, v.surah_number as surahNumber, v.ayah_number as verseNumber, m.mufassir_id as scholarId, m.century, m.madhab, m.period, m.environment, m.origin_country as originCountry, m.reputation_score as reputationScore FROM all_tafsirs t JOIN mufassirs m ON t.mufassir_id = m.mufassir_id JOIN ayahs v ON t.verse_id = v.id WHERE t.embedding IS NOT NULL ORDER BY t.embedding <=> $1::vector LIMIT $2";

    const results = await prisma.$queryRawUnsafe(query, vectorLiteral, limit);

    return (results as unknown[])
      .filter(
        (r: unknown) =>
          (r as any).similarityScore >= (options.minSimilarity || 0.5),
      )
      .map((result: unknown) => {
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
    const sampleTafsirs = await prisma.tafsir.findMany({
      where: buildWhere(),
      include: { mufassir: true, verse: true },
      take: limit,
    });
    return sampleTafsirs.map(mapTafsirResult);
  }
}
