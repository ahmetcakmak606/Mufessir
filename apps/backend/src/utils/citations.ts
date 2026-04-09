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
  scholarReputationScores?: number[]; // Reputation scores of scholars (0-10)
}

export function computeConfidenceScore(input: ConfidenceInput): number {
  const avgSimilarity =
    input.similarityScores.length > 0
      ? input.similarityScores.reduce((acc, v) => acc + v, 0) /
        input.similarityScores.length
      : 0;
  const normalizedSimilarity = Math.max(0, Math.min(1, avgSimilarity));

  // Citations: max out at 5 (more realistic cap)
  const citationFactor = Math.max(0, Math.min(1, input.citationCount / 5));

  // Excerpts: we now send 5 excerpts, so cap at 5
  const excerptFactor = Math.max(0, Math.min(1, input.excerptCount / 5));

  // Scholar reputation factor: average reputation of scholars used (0-10 scale normalized to 0-1)
  const avgReputation =
    input.scholarReputationScores && input.scholarReputationScores.length > 0
      ? input.scholarReputationScores.reduce((acc, v) => acc + v, 0) /
        input.scholarReputationScores.length
      : 5; // Default to middle if no reputation data
  const reputationFactor = Math.max(0, Math.min(1, avgReputation / 10));

  const fallbackPenalty = input.fallback ? 0.2 : 0;

  // Penalty for source-verse mismatch (cross-verse retrieval failure)
  const verseMatchPenalty = input.sourceVerseMatch === false ? 0.3 : 0;

  // Tuned weights: prioritize what we can measure reliably
  // - Citations (35%): Most important academically
  // - Excerpts (30%): More excerpts = better grounding (we send 5 now)
  // - Reputation (25%): Trustworthy scholars improve quality
  // - Similarity (10%): Deprioritized - unreliable without embeddings
  const score =
    normalizedSimilarity * 0.1 + // Low - unreliable without embeddings
    citationFactor * 0.35 + // High - citations are authoritative
    excerptFactor * 0.3 + // High - more source material = better
    reputationFactor * 0.25 + // Medium-high - scholar quality matters
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
