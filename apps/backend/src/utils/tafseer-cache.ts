// Cache key for tafseer results. The key must distinguish everything that
// changes the produced answer: the verse scope (single verse or range — a
// range is normalized so a single verse is start == end, never omitted), the
// output language, the filters, and the pipeline versions (corpus, generation
// prompt, model, translation). Without versions, a prompt or corpus fix would
// keep serving stale cached answers.
import { TRANSLATION_PROMPT_VERSION } from "./translation.js";

// Bump when buildTafsirPrompt or the generation pipeline changes the answer
// for identical inputs, so cached results are not reused across the change.
export const GENERATION_PROMPT_VERSION = "2026-09-13.1";

// Placeholder until Faz 4 introduces real corpus versioning
// (content hashes per source passage).
export const CORPUS_VERSION = "1.0";

export interface TafsirCacheVersions {
  corpus: string;
  prompt: string;
  model: string;
  translation: string;
}

export interface TafsirCacheKeyInput {
  /** Canonical verse id (first verse of a range in range mode). */
  verseId: string;
  surahNumber: number;
  /** Single verse: same as its verse number; range: first and last verse. */
  startVerse: number;
  endVerse: number;
  filters?: Record<string, unknown> | null;
  language?: string | null;
  userId: string;
}

export function defaultCacheVersions(): TafsirCacheVersions {
  return {
    corpus: CORPUS_VERSION,
    prompt: GENERATION_PROMPT_VERSION,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    translation: TRANSLATION_PROMPT_VERSION,
  };
}

// Canonical JSON: object keys sorted at every level so filter key order never
// splits the cache.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function buildTafsirCacheKey(
  input: TafsirCacheKeyInput,
  versions: TafsirCacheVersions = defaultCacheVersions(),
): string {
  return JSON.stringify({
    verseId: input.verseId,
    verseRange: {
      surahNumber: input.surahNumber,
      startVerse: input.startVerse,
      endVerse: input.endVerse,
    },
    language: input.language ?? "Turkish",
    filters: stableStringify(input.filters ?? {}),
    versions,
    userId: input.userId,
  });
}
