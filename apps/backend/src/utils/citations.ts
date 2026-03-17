export interface Citation {
  scholarId: string;
  scholarName: string;
  sourceType: string;
  sourceTitle: string;
  volume: string | null;
  page: string | null;
  edition: string | null;
  citationText: string | null;
  provenance: string | null;
  isPrimary: boolean;
}

export interface SourceExcerpt {
  scholarId: string;
  scholarName: string;
  excerpt: string;
}

export interface ConfidenceInput {
  similarityScores: number[];
  citationCount: number;
  excerptCount: number;
  fallback?: boolean;
  sourceVerseMatch?: boolean; // Whether retrieved sources are from the queried verse
}

export function computeConfidenceScore(input: ConfidenceInput): number {
  const avgSimilarity =
    input.similarityScores.length > 0
      ? input.similarityScores.reduce((acc, v) => acc + v, 0) /
        input.similarityScores.length
      : 0;
  const normalizedSimilarity = Math.max(0, Math.min(1, avgSimilarity));
  const citationFactor = Math.max(0, Math.min(1, input.citationCount / 3));
  const excerptFactor = Math.max(0, Math.min(1, input.excerptCount / 3));
  const fallbackPenalty = input.fallback ? 0.2 : 0;

  // Penalty for source-verse mismatch (cross-verse retrieval failure)
  const verseMatchPenalty = input.sourceVerseMatch === false ? 0.3 : 0;

  // Rebalanced weights: reduce similarity weight (unreliable for cross-lingual)
  // Increase citation weight since we now have that data
  const score =
    normalizedSimilarity * 0.35 + // Reduced from 0.6
    citationFactor * 0.4 + // Increased from 0.25
    excerptFactor * 0.25 - // Increased from 0.15
    fallbackPenalty -
    verseMatchPenalty;

  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}

export function deriveProvenanceIndicator(
  citations: Citation[],
): "PRIMARY" | "MIXED" | "NONE" {
  if (!citations.length) return "NONE";
  if (citations.every((citation) => citation.isPrimary)) return "PRIMARY";
  return "MIXED";
}
