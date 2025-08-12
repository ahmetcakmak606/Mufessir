import { createQueryEmbedding } from "./similarity-search.js";

// Simple text similarity calculation using cosine similarity
export function calculateTextSimilarity(text1: string, text2: string): number {
  // Normalize and tokenize texts
  const tokens1 = normalizeText(text1).split(/\s+/);
  const tokens2 = normalizeText(text2).split(/\s+/);
  
  // Create word frequency vectors
  const allWords = [...new Set([...tokens1, ...tokens2])];
  const vector1 = allWords.map(word => tokens1.filter(t => t === word).length);
  const vector2 = allWords.map(word => tokens2.filter(t => t === word).length);
  
  // Calculate cosine similarity
  const dotProduct = vector1.reduce((sum, val, i) => sum + val * (vector2[i] ?? 0), 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return dotProduct / (magnitude1 * magnitude2);
}

// Advanced similarity calculation using embeddings (when OpenAI is available)
export async function calculateEmbeddingSimilarity(
  aiResponse: string,
  tafsirText: string
): Promise<number> {
  // If embeddings are disabled or we are in sample mode, fall back immediately
  if (
    process.env.SIMILARITY_MODE === 'sample' ||
    process.env.AI_MODE === 'off' ||
    process.env.OPENAI_DISABLED === '1'
  ) {
    return calculateTextSimilarity(aiResponse, tafsirText);
  }

  // Guard against excessively long inputs which can blow token limits
  const MAX_EMBED_INPUT_CHARS = 8000; // ~a few thousand tokens
  const clip = (s: string) => (s.length > MAX_EMBED_INPUT_CHARS ? s.slice(0, MAX_EMBED_INPUT_CHARS) : s);

  try {
    const [embedding1, embedding2] = await Promise.all([
      createQueryEmbedding(clip(aiResponse)) as Promise<number[]>,
      createQueryEmbedding(clip(tafsirText)) as Promise<number[]>,
    ]);

    // Calculate cosine similarity between embeddings
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * (embedding2[i] ?? 0), 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  } catch (error) {
    console.warn("Could not calculate embedding similarity, falling back to text similarity");
    return calculateTextSimilarity(aiResponse, tafsirText);
  }
}

// Find the most similar tafsir to the AI response
export async function findMostSimilarTafsir(
  aiResponse: string,
  tafsirs: Array<{ tafsirId: string; tafsirText: string; scholarName: string }>
): Promise<{ tafsirId: string; scholarName: string; similarityScore: number } | null> {
  if (tafsirs.length === 0) return null;
  
  let bestMatch = { tafsirId: "", scholarName: "", similarityScore: 0 };
  
  for (const tafsir of tafsirs) {
    try {
      const similarity = await calculateEmbeddingSimilarity(aiResponse, tafsir.tafsirText);
      
      if (similarity > bestMatch.similarityScore) {
        bestMatch = {
          tafsirId: tafsir.tafsirId,
          scholarName: tafsir.scholarName,
          similarityScore: similarity
        };
      }
    } catch (error) {
      console.warn(`Error calculating similarity for tafsir ${tafsir.tafsirId}:`, error);
    }
  }
  
  return bestMatch.similarityScore > 0 ? bestMatch : null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
} 