import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

  const aiDisabled = process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";
  const openai = process.env.OPENAI_API_KEY && !aiDisabled
  ? (new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as OpenAI)
  : null;

export interface SimilaritySearchOptions {
  query: string;
  limit?: number;
  verseId?: string;
  scholarIds?: string[];
  excludeScholarIds?: string[];
  minSimilarity?: number;
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

  try {
    const response = await (openai as OpenAI).embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = (response as any).data?.[0]?.embedding as number[] | undefined;
    if (!embedding) throw new Error("No embedding returned");
    return embedding;
  } catch (error) {
    console.error("Error creating embedding:", error);
    throw new Error("Failed to create embedding");
  }
}

export async function performSimilaritySearch(
  prisma: PrismaClient,
  options: SimilaritySearchOptions
): Promise<SimilaritySearchResult[]> {
  const limit = options.limit || 10;
  const minSimilarity = options.minSimilarity || 0.5;

  // Development cost-saver: skip embeddings even if OpenAI is configured
  if (process.env.SIMILARITY_MODE === 'sample') {
    const whereClause: any = {};
    if (options.verseId) whereClause.verseId = options.verseId;
    if (options.scholarIds && options.scholarIds.length > 0) whereClause.scholarId = { in: options.scholarIds };
    if (options.excludeScholarIds && options.excludeScholarIds.length > 0) whereClause.scholarId = { notIn: options.excludeScholarIds };

    const sampleTafsirs = await prisma.tafsir.findMany({
      where: whereClause,
      include: { scholar: true, verse: true },
      take: limit,
    });

    return sampleTafsirs.map((tafsir: any) => ({
      tafsirId: tafsir.id,
      scholarName: tafsir.scholar.name,
      tafsirText: tafsir.tafsirText,
      similarityScore: 0.8,
      verseId: tafsir.verseId,
      surahNumber: tafsir.verse.surahNumber,
      verseNumber: tafsir.verse.verseNumber,
      scholar: {
        id: tafsir.scholar.id,
        name: tafsir.scholar.name,
        century: tafsir.scholar.century,
        madhab: tafsir.scholar.madhab,
        period: tafsir.scholar.period,
        environment: tafsir.scholar.environment,
        originCountry: tafsir.scholar.originCountry,
        reputationScore: tafsir.scholar.reputationScore,
      },
    }));
  }

  // If no OpenAI API key, return sample tafsirs
  if (!openai) {
    console.warn("OpenAI API not configured, using sample tafsirs");
    
    let whereClause: any = {};
    if (options.verseId) {
      whereClause.verseId = options.verseId;
    }
    if (options.scholarIds && options.scholarIds.length > 0) {
      whereClause.scholarId = { in: options.scholarIds };
    }
    if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
      whereClause.scholarId = { notIn: options.excludeScholarIds };
    }

    const sampleTafsirs = await prisma.tafsir.findMany({
      where: whereClause,
      include: {
        scholar: true,
        verse: true,
      },
      take: limit,
    });

    return sampleTafsirs.map((tafsir: any) => ({
      tafsirId: tafsir.id,
      scholarName: tafsir.scholar.name,
      tafsirText: tafsir.tafsirText,
      similarityScore: 0.8, // Mock similarity score
      verseId: tafsir.verseId,
      surahNumber: tafsir.verse.surahNumber,
      verseNumber: tafsir.verse.verseNumber,
      scholar: {
        id: tafsir.scholar.id,
        name: tafsir.scholar.name,
        century: tafsir.scholar.century,
        madhab: tafsir.scholar.madhab,
        period: tafsir.scholar.period,
        environment: tafsir.scholar.environment,
        originCountry: tafsir.scholar.originCountry,
        reputationScore: tafsir.scholar.reputationScore,
      },
    }));
  }

  try {
    // Create embedding for the query
    const queryEmbedding = await createQueryEmbedding(options.query);
    // pgvector expects a vector-typed parameter; pass as a string literal and cast
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    // Build the WHERE clause for scholar filtering
    let whereClause = "WHERE t.embedding IS NOT NULL";
    const params: any[] = [vectorLiteral];

    if (options.verseId) {
      whereClause += ` AND t."verseId" = $2`;
      params.push(options.verseId);
    }

    if (options.scholarIds && options.scholarIds.length > 0) {
      whereClause += ` AND t."scholarId" = ANY($${params.length + 1})`;
      params.push(options.scholarIds);
    }

    if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
      whereClause += ` AND t."scholarId" != ALL($${params.length + 1})`;
      params.push(options.excludeScholarIds);
    }

    // Perform vector similarity search
    const query = `
      SELECT 
        t.id as "tafsirId",
        s.name as "scholarName",
        t."tafsirText",
        1 - (t."embedding" <=> $1::vector) as "similarityScore",
        v.id as "verseId",
        v."surahNumber",
        v."verseNumber",
        s.id as "scholarId",
        s.name as "scholarName",
        s.century,
        s.madhab,
        s.period,
        s.environment,
        s."originCountry",
        s."reputationScore"
      FROM "Tafsir" t
      JOIN "Scholar" s ON t."scholarId" = s.id
      JOIN "Verse" v ON t."verseId" = v.id
      ${whereClause}
      ORDER BY t."embedding" <=> $1::vector
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    // Use prisma.$queryRawUnsafe to pass dynamic SQL string with parameters safely
    const results = await prisma.$queryRawUnsafe(query as string, ...params as any[]);

    // Filter by minimum similarity and format results
    return (results as any[])
      .filter((result: any) => result.similarityScore >= minSimilarity)
      .map((result: any) => ({
        tafsirId: result.tafsirId,
        scholarName: result.scholarName,
        tafsirText: result.tafsirText,
        similarityScore: result.similarityScore,
        verseId: result.verseId,
        surahNumber: result.surahNumber,
        verseNumber: result.verseNumber,
        scholar: {
          id: result.scholarId,
          name: result.scholarName,
          century: result.century,
          madhab: result.madhab,
          period: result.period,
          environment: result.environment,
          originCountry: result.originCountry,
          reputationScore: result.reputationScore,
        },
      }));
  } catch (error) {
    console.error("Similarity search error:", error);
    throw new Error("Failed to perform similarity search");
  }
} 