import { describe, expect, it } from "vitest";
import {
  computeCompatibilityReputationScore,
  deriveCenturyFromHijri,
  derivePeriodCode,
  deriveSourceAccessibility,
} from "../src/utils/scholar-metadata.js";

describe("scholar metadata derivation", () => {
  it("derives century from hijri death year", () => {
    expect(deriveCenturyFromHijri(1)).toBe(1);
    expect(deriveCenturyFromHijri(150)).toBe(2);
    expect(deriveCenturyFromHijri(401)).toBe(5);
    expect(deriveCenturyFromHijri(null)).toBeNull();
  });

  it("maps period boundaries correctly", () => {
    expect(derivePeriodCode(150)).toBe("FOUNDATION");
    expect(derivePeriodCode(400)).toBe("CLASSICAL_EARLY");
    expect(derivePeriodCode(700)).toBe("CLASSICAL_MATURE");
    expect(derivePeriodCode(1200)).toBe("POST_CLASSICAL");
    expect(derivePeriodCode(1400)).toBe("MODERN");
    expect(derivePeriodCode(1401)).toBe("CONTEMPORARY");
  });

  it("derives accessibility from book id presence", () => {
    expect(deriveSourceAccessibility("12345")).toBe("PARTIAL_DIGITAL");
    expect(deriveSourceAccessibility("")).toBeNull();
    expect(deriveSourceAccessibility(null)).toBeNull();
  });

  it("computes compatibility reputation score as 1-decimal average", () => {
    expect(
      computeCompatibilityReputationScore({
        scholarlyInfluence: 5,
        methodologicalRigor: 4,
        corpusBreadth: 5,
      })
    ).toBe(4.7);
    expect(
      computeCompatibilityReputationScore({
        scholarlyInfluence: 5,
        methodologicalRigor: 4,
        corpusBreadth: null,
      })
    ).toBeNull();
  });
});

