import { describe, expect, it } from "vitest";
import {
  clampVerseRange,
  deserializeReplayPayload,
  MAX_VERSE_RANGE,
  normalizeTafseerResponseToRun,
  serializeReplayPayload,
  type ReplayPayload,
} from "@/lib/tafseer";

describe("clampVerseRange", () => {
  it("keeps in-range selections untouched", () => {
    expect(clampVerseRange(1, 5, 286)).toBe(5);
    expect(clampVerseRange(100, 100, 286)).toBe(100);
  });

  it("clamps the end verse to the shared 10-verse limit", () => {
    expect(clampVerseRange(1, 286, 286)).toBe(MAX_VERSE_RANGE);
    expect(clampVerseRange(50, 70, 286)).toBe(50 + MAX_VERSE_RANGE - 1);
  });

  it("never lets the end fall below the start or beyond the surah", () => {
    expect(clampVerseRange(7, 3, 286)).toBe(7);
    expect(clampVerseRange(3, 12, 5)).toBe(5);
  });
});

describe("tafseer lib helpers", () => {
  it("serializes and deserializes replay payloads", () => {
    const payload: ReplayPayload = {
      verseId: "verse-1-1",
      filters: {
        methodTags: ["RIVAYET"],
        language: "English",
      },
    };

    const raw = serializeReplayPayload(payload);
    const parsed = deserializeReplayPayload(raw);

    expect(parsed).toEqual(payload);
  });

  it("returns null for invalid replay payloads", () => {
    expect(deserializeReplayPayload("bad-json")).toBeNull();
    expect(
      deserializeReplayPayload(JSON.stringify({ filters: {} })),
    ).toBeNull();
  });

  it("normalizes tafseer response into canonical run shape", () => {
    const run = normalizeTafseerResponseToRun(
      {
        verse: {
          id: "verse-2-255",
          surahNumber: 2,
          surahName: "Bakara",
          verseNumber: 255,
        },
        filters: { methodTags: ["DIRAYET"] },
        aiResponse: "Test response",
        confidence: 0.82,
        provenance: "PRIMARY",
        citations: [],
        sourceExcerpts: [],
        runId: "run-1",
        searchId: "search-1",
      },
      {
        title: "Ayat al-Kursi",
      },
    );

    expect(run.runId).toBe("run-1");
    expect(run.searchId).toBe("search-1");
    expect(run.verse.id).toBe("verse-2-255");
    expect(run.confidence).toBe(0.82);
    expect(run.provenance).toBe("PRIMARY");
    expect(run.title).toBe("Ayat al-Kursi");
  });
});
