import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SimilaritySearchOptions {
  query: string;
  limit?: number;
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
}

export async function performSimilaritySearch(
  queryEmbedding: number[],
  options: SimilaritySearchOptions
): Promise<SimilaritySearchResult[]> {
  const limit = options.limit || 50;
  const minSimilarity = options.minSimilarity || 0.5;

  // Build the WHERE clause for scholar filtering
  let whereClause = "WHERE t.embedding IS NOT NULL";
  const params: any[] = [queryEmbedding];

  if (options.scholarIds && options.scholarIds.length > 0) {
    whereClause += ` AND t."scholarId" = ANY($2)`;
    params.push(options.scholarIds);
  }

  if (options.excludeScholarIds && options.excludeScholarIds.length > 0) {
    whereClause += ` AND t."scholarId" != ALL($3)`;
    params.push(options.excludeScholarIds);
  }

  // Perform vector similarity search
  const query = `
    SELECT 
      t.id as "tafsirId",
      s.name as "scholarName",
      t."tafsirText",
      t."embedding" <=> $1 as "similarityScore",
      v.id as "verseId",
      v."surahNumber",
      v."verseNumber"
    FROM "Tafsir" t
    JOIN "Scholar" s ON t."scholarId" = s.id
    JOIN "Verse" v ON t."verseId" = v.id
    ${whereClause}
    ORDER BY t."embedding" <=> $1
    LIMIT $${params.length + 1}
  `;

  params.push(limit);

  const results = await prisma.$queryRaw<SimilaritySearchResult[]>(query, ...params);

  // Filter by minimum similarity and format results
  return results
    .filter(result => result.similarityScore <= (1 - minSimilarity)) // Lower score = more similar
    .map(result => ({
      ...result,
      similarityScore: 1 - result.similarityScore, // Convert to 0-1 scale where 1 = most similar
    }));
}

export async function getTafsirEmbedding(tafsirId: string): Promise<number[] | null> {
  const tafsir = await prisma.tafsir.findUnique({
    where: { id: tafsirId },
    select: { embedding: true },
  });

  return tafsir?.embedding || null;
}

export async function createQueryEmbedding(text: string): Promise<number[]> {
  // This would typically call OpenAI API
  // For now, return a placeholder
  // In the actual implementation, this would call OpenAI's embedding API
  throw new Error("Query embedding not implemented yet - needs OpenAI integration");
} 