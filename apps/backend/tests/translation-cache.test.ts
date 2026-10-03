import { describe, it, expect } from "vitest";
import { computeTranslationCacheKey } from "../src/utils/translation.js";

describe("translation cache key", () => {
  // Regression: the old scheme (base64 of the full string, first 200 chars)
  // returned the same key for any two Arabic texts sharing a long prefix,
  // so the first text's Turkish translation could be served for the second.
  it("gives different keys to texts sharing a long common prefix", () => {
    const sharedPrefix =
      "قال الإمام الطبري في تفسير هذه الآية ما ملخصه" + "أ".repeat(300);
    const key1 = computeTranslationCacheKey(
      `${sharedPrefix} وأول القول مختلف تماما`,
      "ar",
      "tr",
    );
    const key2 = computeTranslationCacheKey(
      `${sharedPrefix} والقول الثاني مختلف عن الأول`,
      "ar",
      "tr",
    );
    expect(key1).not.toBe(key2);
  });

  it("is stable for identical input", () => {
    expect(computeTranslationCacheKey("نص", "ar", "tr")).toBe(
      computeTranslationCacheKey("نص", "ar", "tr"),
    );
  });

  it("separates language pairs", () => {
    expect(computeTranslationCacheKey("text", "ar", "tr")).not.toBe(
      computeTranslationCacheKey("text", "ar", "en"),
    );
  });

  it("separates models, so a model change invalidates old translations", () => {
    const previous = process.env.OPENAI_MODEL;
    try {
      process.env.OPENAI_MODEL = "gpt-4o";
      const a = computeTranslationCacheKey("text", "ar", "tr");
      process.env.OPENAI_MODEL = "gpt-4o-mini";
      const b = computeTranslationCacheKey("text", "ar", "tr");
      expect(a).not.toBe(b);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = previous;
    }
  });

  it("produces a full sha256 hex digest, not a truncated prefix", () => {
    expect(computeTranslationCacheKey("text", "ar", "tr")).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
