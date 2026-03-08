import { describe, expect, it } from "vitest";
import {
  buildScholarPatch,
  parseOptionalBoolean,
  parseOptionalInt,
  referenceFingerprint,
  validateReferenceRequirement,
} from "../src/utils/scholar-enrichment.js";

describe("scholar enrichment utils", () => {
  it("parses optional integer values", () => {
    expect(parseOptionalInt("42")).toBe(42);
    expect(parseOptionalInt(10)).toBe(10);
    expect(parseOptionalInt(" ")).toBeNull();
    expect(parseOptionalInt(null)).toBeNull();
    expect(() => parseOptionalInt("4.2")).toThrow(/Expected integer value/);
  });

  it("parses optional boolean values", () => {
    expect(parseOptionalBoolean(true)).toBe(true);
    expect(parseOptionalBoolean(false)).toBe(false);
    expect(parseOptionalBoolean("yes")).toBe(true);
    expect(parseOptionalBoolean("0")).toBe(false);
    expect(parseOptionalBoolean(" ")).toBeNull();
    expect(() => parseOptionalBoolean("maybe")).toThrow(/Expected boolean value/);
  });

  it("builds patch without overwriting populated fields by default", () => {
    const patch = buildScholarPatch(
      {
        mufassirTr: "Yeni Isim",
        mufassirEn: "New Name",
        birthYear: 100,
        deathYear: 200,
      },
      {
        mufassirTr: "Mevcut Isim",
        mufassirEn: null,
        birthYear: 90,
        deathYear: null,
      },
      false
    );

    expect(patch).toEqual({
      mufassirEn: "New Name",
      deathYear: 200,
    });
  });

  it("requires citation fields when patch is present", () => {
    const errors = validateReferenceRequirement(
      { mufassirTr: "Yeni Isim" },
      {
        sourceType: null,
        sourceTitle: null,
        volume: null,
        page: null,
        edition: null,
        citationText: null,
        provenance: null,
        isPrimary: true,
      }
    );

    expect(errors).toHaveLength(3);
  });

  it("accepts complete reference requirements", () => {
    const errors = validateReferenceRequirement(
      { mufassirTr: "Yeni Isim" },
      {
        sourceType: "book",
        sourceTitle: "Tabaqat",
        volume: "2",
        page: null,
        edition: null,
        citationText: null,
        provenance: "manual",
        isPrimary: true,
      }
    );

    expect(errors).toEqual([]);
  });

  it("normalizes reference fingerprint for deduplication", () => {
    const a = referenceFingerprint("scholar-1", {
      sourceType: " Book ",
      sourceTitle: "Tabaqat",
      volume: "2",
      page: "10",
      edition: null,
      citationText: "Line",
    });
    const b = referenceFingerprint("scholar-1", {
      sourceType: "book",
      sourceTitle: " tabaqat ",
      volume: "2",
      page: "10",
      edition: "",
      citationText: " line ",
    });

    expect(a).toBe(b);
  });
});
