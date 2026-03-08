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

export function computeConfidenceScore(input: {
  similarityScores: number[];
  citationCount: number;
  excerptCount: number;
  fallback?: boolean;
}): number {
  const avgSimilarity =
    input.similarityScores.length > 0
      ? input.similarityScores.reduce((acc, v) => acc + v, 0) /
        input.similarityScores.length
      : 0;
  const normalizedSimilarity = Math.max(0, Math.min(1, avgSimilarity));
  const citationFactor = Math.max(0, Math.min(1, input.citationCount / 3));
  const excerptFactor = Math.max(0, Math.min(1, input.excerptCount / 3));
  const fallbackPenalty = input.fallback ? 0.2 : 0;
  const score =
    normalizedSimilarity * 0.6 + citationFactor * 0.25 + excerptFactor * 0.15 - fallbackPenalty;
  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}

export function deriveProvenanceIndicator(citations: Citation[]): "PRIMARY" | "MIXED" | "NONE" {
  if (!citations.length) return "NONE";
  if (citations.every((citation) => citation.isPrimary)) return "PRIMARY";
  return "MIXED";
}

