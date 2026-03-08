export type ScholarPeriodCode =
  | "FOUNDATION"
  | "CLASSICAL_EARLY"
  | "CLASSICAL_MATURE"
  | "POST_CLASSICAL"
  | "MODERN"
  | "CONTEMPORARY";

export type SourceAccessibilityCode =
  | "FULL_DIGITAL"
  | "PARTIAL_DIGITAL"
  | "MANUSCRIPT_ONLY"
  | "LOST";

export const PERIOD_CODES: ScholarPeriodCode[] = [
  "FOUNDATION",
  "CLASSICAL_EARLY",
  "CLASSICAL_MATURE",
  "POST_CLASSICAL",
  "MODERN",
  "CONTEMPORARY",
];

export const SOURCE_ACCESSIBILITY_CODES: SourceAccessibilityCode[] = [
  "FULL_DIGITAL",
  "PARTIAL_DIGITAL",
  "MANUSCRIPT_ONLY",
  "LOST",
];

export function deriveCenturyFromHijri(deathHijri: number | null | undefined): number | null {
  if (!deathHijri || deathHijri <= 0) return null;
  return Math.ceil(deathHijri / 100);
}

export function derivePeriodCode(
  deathHijri: number | null | undefined
): ScholarPeriodCode | null {
  if (!deathHijri || deathHijri <= 0) return null;
  if (deathHijri <= 150) return "FOUNDATION";
  if (deathHijri <= 400) return "CLASSICAL_EARLY";
  if (deathHijri <= 700) return "CLASSICAL_MATURE";
  if (deathHijri <= 1200) return "POST_CLASSICAL";
  if (deathHijri <= 1400) return "MODERN";
  return "CONTEMPORARY";
}

export function deriveSourceAccessibility(
  bookId: string | null | undefined
): SourceAccessibilityCode | null {
  if (!bookId || !bookId.trim()) return null;
  return "PARTIAL_DIGITAL";
}

export function computeCompatibilityReputationScore({
  scholarlyInfluence,
  methodologicalRigor,
  corpusBreadth,
}: {
  scholarlyInfluence?: number | null;
  methodologicalRigor?: number | null;
  corpusBreadth?: number | null;
}): number | null {
  const values = [scholarlyInfluence, methodologicalRigor, corpusBreadth].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (values.length !== 3) return null;
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return Number(avg.toFixed(1));
}

