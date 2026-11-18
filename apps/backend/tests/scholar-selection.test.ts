import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCHOLAR_IDS,
  MAX_SELECTED_SCHOLARS,
  SCHOLAR_LIMIT_ERROR,
  ScholarSelectionError,
  normalizeScholarSelection,
} from "../src/utils/scholar-selection.js";

describe("normalizeScholarSelection (18 Kas kuralı)", () => {
  it("seçim yoksa varsayılan beşliyi koyar: Taberî, Mâtürîdî, Zemahşerî, Râzî, İbn Kesîr", () => {
    expect(DEFAULT_SCHOLAR_IDS).toEqual(["7", "9", "19", "22", "29"]);
    expect(normalizeScholarSelection(undefined).scholars).toEqual([...DEFAULT_SCHOLAR_IDS]);
    expect(normalizeScholarSelection({ scholars: [] }).scholars).toEqual([...DEFAULT_SCHOLAR_IDS]);
  });

  it("en fazla 5 seçimi olduğu gibi korur", () => {
    const five = ["1", "2", "3", "4", "5"];
    expect(normalizeScholarSelection({ scholars: five }).scholars).toEqual(five);
    expect(MAX_SELECTED_SCHOLARS).toBe(5);
  });

  it("6 ve üzeri seçimi sessizce kırpmaz, Türkçe hata ile reddeder", () => {
    expect(() =>
      normalizeScholarSelection({ scholars: ["1", "2", "3", "4", "5", "6"] }),
    ).toThrow(ScholarSelectionError);
    expect(SCHOLAR_LIMIT_ERROR).toBe("En fazla 5 müfessir seçebilirsiniz.");
  });

  it("yinelenen kimlikleri tek sayar", () => {
    expect(
      normalizeScholarSelection({ scholars: ["7", "7", "9", "9", "19", "22"] }).scholars,
    ).toEqual(["7", "9", "19", "22"]);
  });

  it("mufassirs takma adını da sınırlar", () => {
    expect(() =>
      normalizeScholarSelection({ mufassirs: ["1", "2", "3", "4", "5", "6"] }),
    ).toThrow(ScholarSelectionError);
    expect(normalizeScholarSelection({ mufassirs: ["3"] }).scholars).toEqual(["3"]);
  });

  it("yalnız dışlama listesi varsa varsayılanı zorlamaz", () => {
    expect(normalizeScholarSelection({ excludeScholars: ["7"] }).scholars).toEqual([]);
  });
});
