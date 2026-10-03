import { describe, it, expect } from "vitest";
import {
  buildTafsirCacheKey,
  defaultCacheVersions,
  type TafsirCacheKeyInput,
} from "../src/utils/tafseer-cache.js";

const baseInput: TafsirCacheKeyInput = {
  verseId: "verse-27-18",
  surahNumber: 27,
  startVerse: 18,
  endVerse: 19,
  filters: { language: "Turkish" },
  language: "Turkish",
  userId: "user-1",
};

const versions = defaultCacheVersions();

describe("tafseer result cache key", () => {
  it("separates ranges that start at the same verse", () => {
    const a = buildTafsirCacheKey(baseInput, versions);
    const b = buildTafsirCacheKey({ ...baseInput, endVerse: 20 }, versions);
    expect(a).not.toBe(b);
  });

  it("separates a single verse from a range starting at that verse", () => {
    // Regression: the old key used only the first verse id, so 27:18 and
    // 27:18–19 shared a cache entry.
    const single = buildTafsirCacheKey(
      { ...baseInput, startVerse: 18, endVerse: 18 },
      versions,
    );
    const range = buildTafsirCacheKey(baseInput, versions);
    expect(single).not.toBe(range);
  });

  it("normalizes a single verse to start == end, so it never matches a range", () => {
    const explicitSingle = buildTafsirCacheKey(
      { ...baseInput, startVerse: 18, endVerse: 18 },
      versions,
    );
    expect(JSON.parse(explicitSingle).verseRange).toEqual({
      surahNumber: 27,
      startVerse: 18,
      endVerse: 18,
    });
  });

  it("is stable regardless of filter key order", () => {
    const a = buildTafsirCacheKey(
      {
        ...baseInput,
        filters: { language: "Turkish", methodTags: ["turath"], scholars: [3, 1] },
      },
      versions,
    );
    const b = buildTafsirCacheKey(
      {
        ...baseInput,
        filters: { scholars: [3, 1], methodTags: ["turath"], language: "Turkish" },
      },
      versions,
    );
    expect(a).toBe(b);
  });

  it("separates output languages", () => {
    const a = buildTafsirCacheKey(
      { ...baseInput, language: "Turkish", filters: { language: "Turkish" } },
      versions,
    );
    const b = buildTafsirCacheKey(
      { ...baseInput, language: "English", filters: { language: "English" } },
      versions,
    );
    expect(a).not.toBe(b);
  });

  it("separates users", () => {
    const a = buildTafsirCacheKey(baseInput, versions);
    const b = buildTafsirCacheKey({ ...baseInput, userId: "user-2" }, versions);
    expect(a).not.toBe(b);
  });

  it("invalidates cached answers when any pipeline version changes", () => {
    const a = buildTafsirCacheKey(baseInput, versions);
    for (const override of [
      { corpus: "1.1" },
      { prompt: "2026-09-14.1" },
      { model: "gpt-4o" },
      { translation: "v2" },
    ]) {
      const b = buildTafsirCacheKey(baseInput, { ...versions, ...override });
      expect(a).not.toBe(b);
    }
  });

  it("is stable for identical input", () => {
    expect(buildTafsirCacheKey(baseInput, versions)).toBe(
      buildTafsirCacheKey(baseInput, versions),
    );
  });
});
