import { describe, it, expect } from "vitest";
import { buildTafsirPrompt } from "../src/utils/prompt.js";
import { analyzeScholarGroup } from "../src/routes/tafseer.js";

const baseOptions = {
  verseText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  tafsirExcerpts: [
    {
      scholar: { name: "Al-Tabari", century: 3 },
      excerpt: "قال الطبري: البسملة استفتاحٌ للقراءة.",
    },
  ],
  arabicTerms: ["البسملة", "الاستفتاح"],
  userParams: { language: "Turkish" },
};

describe("buildTafsirPrompt", () => {
  it("never mandates verbatim term usage (regression: VERBATIM instructions)", () => {
    const prompt = buildTafsirPrompt(baseOptions);
    expect(prompt).not.toContain("VERBATIM");
    expect(prompt).not.toContain("INCLUDE THESE");
    // Terms remain available as optional context.
    expect(prompt).toContain("Arabic Terms Observed in Sources");
    expect(prompt).toContain("البسملة");
  });

  it("never instructs the model to merge scholars into a group", () => {
    const prompt = buildTafsirPrompt({
      ...baseOptions,
      scholarAnalysis: {
        dominantMadhab: "Hanafi",
        dominantPeriod: null,
        totalScholars: 9,
        hasMultipleMadhhabs: false,
        scholarContext:
          "Bu tefsir yanıtında bu sorgu için getirilen 9 farklı müfessirin pasajları kullanılmıştır.",
      },
    });
    expect(prompt).not.toContain("as a GROUP");
    expect(prompt).not.toContain("çoğunluğu");
    // Individual attribution is required even with many scholars.
    expect(prompt).toContain(
      "Explicitly mention which scholar you're referencing",
    );
    expect(prompt).toContain("Do NOT merge selected scholars' views");
  });

  it("embeds a factual scope statement without general-view claims", () => {
    const prompt = buildTafsirPrompt({
      ...baseOptions,
      scholarAnalysis: {
        dominantMadhab: "Hanafi",
        dominantPeriod: null,
        totalScholars: 4,
        hasMultipleMadhhabs: false,
        scholarContext:
          "Bu tefsir yanıtında bu sorgu için getirilen 4 farklı müfessirin pasajları kullanılmıştır.",
      },
    });
    expect(prompt).toContain("4 farklı müfessirin pasajları");
    expect(prompt).not.toContain("genel görüşlerini yansıtmaktadır");
  });
});

describe("analyzeScholarGroup", () => {
  const scholar = (id: number, madhab?: string, period?: string) => ({
    mufassir: { id: String(id), name: `Scholar ${id}`, madhab, period },
  });

  it("counts unique scholars, not retrieval rows", () => {
    // Regression: range queries return the same mufassir once per verse;
    // row counting reported 5 scholars where there are 2.
    const rows = [
      scholar(1, "Hanafi"),
      scholar(1, "Hanafi"),
      scholar(1, "Hanafi"),
      scholar(1, "Hanafi"),
      scholar(2, "Shafii"),
    ];
    const analysis = analyzeScholarGroup(rows);
    expect(analysis.totalScholars).toBe(2);
    expect(analysis.madhabCounts).toEqual({ Hanafi: 1, Shafii: 1 });
  });

  it("produces no general-view claims in the scope statement", () => {
    const rows = [scholar(1, "Hanafi"), scholar(2, "Hanafi"), scholar(3)];
    const analysis = analyzeScholarGroup(rows);
    expect(analysis.scholarContext).not.toContain(
      "genel görüşlerini yansıtmaktadır",
    );
    expect(analysis.scholarContext).toContain("3 farklı müfessirin");
  });

  it("keeps dominant madhab/period as data without asserting them as the answer's frame", () => {
    const analysis = analyzeScholarGroup([
      scholar(1, "Hanafi"),
      scholar(2, "Hanafi"),
      scholar(3, "Maliki"),
    ]);
    expect(analysis.dominantMadhab).toBe("Hanafi");
    expect(analysis.hasMultipleMadhhabs).toBe(true);
    expect(analysis.scholarContext).not.toContain("Hanafi alimlerinin");
  });
});
