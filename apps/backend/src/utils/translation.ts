import { createHash } from "crypto";
import OpenAI from "openai";

const aiDisabled =
  process.env.AI_MODE === "off" || process.env.OPENAI_DISABLED === "1";

const openai =
  process.env.OPENAI_API_KEY && !aiDisabled
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

// Bump when the translation prompt below changes in a way that should
// invalidate previously cached translations. Exported for the tafsir result
// cache key, which must also separate translation versions.
export const TRANSLATION_PROMPT_VERSION = "v1";

interface TranslationResult {
  translatedText: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface CacheEntry {
  translatedText: string;
  timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache
const MAX_CACHE_SIZE = 1000;

// Cryptographic hash over the full text plus languages, model and prompt
// version. The previous scheme (first 200 chars of base64) collided for any
// two inputs sharing a ~150-byte prefix — e.g. tafsir passages from the same
// work — and could return the first text's translation for the second.
export function computeTranslationCacheKey(
  text: string,
  source: string,
  target: string,
): string {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return createHash("sha256")
    .update(`${source}:${target}:${model}:${TRANSLATION_PROMPT_VERSION}:${text}`)
    .digest("hex");
}

function getCachedTranslation(cacheKey: string): TranslationResult | null {
  const entry = translationCache.get(cacheKey);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return { translatedText: entry.translatedText };
  }
  translationCache.delete(cacheKey);
  return null;
}

function setCachedTranslation(
  cacheKey: string,
  result: TranslationResult,
): void {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, {
    translatedText: result.translatedText,
    timestamp: Date.now(),
  });
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  if (!openai) {
    throw new Error("OpenAI not configured for translation");
  }

  if (!text || text.trim().length === 0) {
    return { translatedText: "" };
  }

  const cacheKey = computeTranslationCacheKey(text, sourceLanguage, targetLanguage);
  const cached = getCachedTranslation(cacheKey);
  if (cached) {
    return cached;
  }

  const sourceName =
    sourceLanguage === "ar"
      ? "Arabic (العربية)"
      : sourceLanguage === "tr"
        ? "Turkish (Türkçe)"
        : sourceLanguage;
  const targetName =
    targetLanguage === "ar"
      ? "Arabic (العربية)"
      : targetLanguage === "tr"
        ? "Turkish (Türkçe)"
        : targetLanguage;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text from ${sourceName} to ${targetName}. Preserve the meaning, tone, and scholarly style. Do not add any explanations or comments.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const translatedText = response.choices[0]?.message?.content || "";
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    const result = { translatedText, usage };
    setCachedTranslation(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error(
      `Failed to translate: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function translateToTurkish(
  arabicText: string,
): Promise<TranslationResult> {
  return translateText(arabicText, "ar", "tr");
}
