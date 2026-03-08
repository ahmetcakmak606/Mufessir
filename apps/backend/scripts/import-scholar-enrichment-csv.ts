#!/usr/bin/env tsx
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  PrismaClient,
  ScholarPeriod,
  SourceAccessibility,
  TraditionAcceptance,
  type Prisma,
} from "@prisma/client";
import { config } from "dotenv";
import {
  buildScholarPatch,
  normalizeNullableText,
  parseOptionalBoolean,
  parseOptionalInt,
  referenceFingerprint,
  validateReferenceRequirement,
  type ScholarPatchInput,
  type ScholarReferenceInput,
} from "../src/utils/scholar-enrichment.js";
import {
  computeCompatibilityReputationScore,
  deriveCenturyFromHijri,
  derivePeriodCode,
  deriveSourceAccessibility,
  SOURCE_ACCESSIBILITY_CODES,
} from "../src/utils/scholar-metadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const CSV_PATH =
  process.env.SCHOLAR_ENRICHMENT_CSV_PATH ||
  resolve(__dirname, "../../../docs/SCHOLAR_ENRICHMENT_TEMPLATE.csv");

const dryRun = process.env.DRY_RUN === "1";
const allowOverwrite = process.env.ALLOW_OVERWRITE === "1";

const expectedColumns = [
  "scholar_id",
  "scholar_name",
  "mufassir_tr",
  "mufassir_en",
  "mufassir_ar",
  "mufassir_name_long",
  "birth_year",
  "death_year",
  "death_hijri",
  "madhab",
  "environment",
  "origin_country",
  "book_id",
  "tafsir_type1",
  "tafsir_type2",
  "explanation",
  "detail_information",
  "scholarly_influence",
  "methodological_rigor",
  "corpus_breadth",
  "tradition_acceptance",
  "source_accessibility",
  "source_type",
  "source_title",
  "volume",
  "page",
  "edition",
  "citation_text",
  "provenance",
  "is_primary",
] as const;

type CsvRow = Record<string, string>;

type ScholarSnapshot = {
  id: string;
  name: string;
  mufassirTr: string | null;
  mufassirEn: string | null;
  mufassirAr: string | null;
  mufassirNameLong: string | null;
  birthYear: number | null;
  deathYear: number | null;
  deathHijri: number | null;
  century: number;
  madhab: string | null;
  period: string | null;
  periodCode: ScholarPeriod | null;
  environment: string | null;
  originCountry: string | null;
  bookId: string | null;
  tafsirType1: string | null;
  tafsirType2: string | null;
  explanation: string | null;
  detailInformation: string | null;
  scholarlyInfluence: number | null;
  methodologicalRigor: number | null;
  corpusBreadth: number | null;
  sourceAccessibility: SourceAccessibility | null;
  traditionAcceptance: TraditionAcceptance[];
  reputationScore: number | null;
};

const SOURCE_ACCESSIBILITY_SET = new Set(SOURCE_ACCESSIBILITY_CODES);
const TRADITION_ACCEPTANCE_SET = new Set(Object.values(TraditionAcceptance));

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (next === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      }
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNullableCsv(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (["null", "n/a", "na", "none", "-"].includes(lowered)) {
    return null;
  }
  return normalized;
}

function getColumn(row: CsvRow, ...aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) return value;
  }
  return "";
}

function parseOptionalScore(value: string | null | undefined, label: string): number | null {
  const parsed = parseOptionalInt(value);
  if (parsed === null) return null;
  if (parsed < 1 || parsed > 5) {
    throw new Error(`${label} must be an integer between 1 and 5`);
  }
  return parsed;
}

function normalizeEnumCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function parseSourceAccessibility(value: string | null | undefined): SourceAccessibility | null {
  const normalized = normalizeNullableCsv(value);
  if (!normalized) return null;
  const code = normalizeEnumCode(normalized);
  if (!SOURCE_ACCESSIBILITY_SET.has(code as SourceAccessibility)) {
    throw new Error(`invalid source_accessibility code "${normalized}"`);
  }
  return code as SourceAccessibility;
}

function parseTraditionAcceptance(
  value: string | null | undefined
): TraditionAcceptance[] | null {
  const normalized = normalizeNullableCsv(value);
  if (!normalized) return null;

  const parts = normalized
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  const parsed: TraditionAcceptance[] = [];
  const seen = new Set<TraditionAcceptance>();

  for (const part of parts) {
    const code = normalizeEnumCode(part) as TraditionAcceptance;
    if (!TRADITION_ACCEPTANCE_SET.has(code)) {
      throw new Error(`invalid tradition_acceptance code "${part}"`);
    }
    if (!seen.has(code)) {
      seen.add(code);
      parsed.push(code);
    }
  }

  return parsed;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hasReferenceData(reference: ScholarReferenceInput): boolean {
  return Boolean(
    normalizeNullableText(reference.sourceType) ||
      normalizeNullableText(reference.sourceTitle) ||
      normalizeNullableText(reference.volume) ||
      normalizeNullableText(reference.page) ||
      normalizeNullableText(reference.edition) ||
      normalizeNullableText(reference.citationText) ||
      normalizeNullableText(reference.provenance)
  );
}

function buildNameIndex(scholars: ScholarSnapshot[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const scholar of scholars) {
    const candidates = [
      scholar.name,
      scholar.mufassirTr,
      scholar.mufassirEn,
      scholar.mufassirAr,
      scholar.mufassirNameLong,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const key = normalizeLookup(candidate);
      if (!key) continue;
      const set = map.get(key) || new Set<string>();
      set.add(scholar.id);
      map.set(key, set);
    }
  }

  return new Map(Array.from(map.entries()).map(([key, ids]) => [key, Array.from(ids)]));
}

function applyDerivations(
  patch: Prisma.ScholarUpdateInput,
  existing: ScholarSnapshot,
  overwrite: boolean
): void {
  const deathHijri = (patch.deathHijri as number | null | undefined) ?? existing.deathHijri;
  const bookId = (patch.bookId as string | null | undefined) ?? existing.bookId;
  const scholarlyInfluence =
    (patch.scholarlyInfluence as number | null | undefined) ?? existing.scholarlyInfluence;
  const methodologicalRigor =
    (patch.methodologicalRigor as number | null | undefined) ?? existing.methodologicalRigor;
  const corpusBreadth =
    (patch.corpusBreadth as number | null | undefined) ?? existing.corpusBreadth;

  const nextCentury = deriveCenturyFromHijri(deathHijri);
  if (
    typeof nextCentury === "number" &&
    (overwrite || existing.century === 0 || "deathHijri" in patch) &&
    existing.century !== nextCentury
  ) {
    patch.century = nextCentury;
  }

  const nextPeriodCode = derivePeriodCode(deathHijri);
  if (nextPeriodCode && (overwrite || !existing.periodCode || "deathHijri" in patch)) {
    if (existing.periodCode !== nextPeriodCode) {
      patch.periodCode = nextPeriodCode;
    }
    if (overwrite || !normalizeNullableText(existing.period)) {
      patch.period = nextPeriodCode;
    }
  }

  const explicitAccessibility = patch.sourceAccessibility as SourceAccessibility | undefined;
  if (!explicitAccessibility) {
    const derivedAccessibility = deriveSourceAccessibility(bookId) as SourceAccessibility | null;
    if (
      derivedAccessibility &&
      (overwrite || !existing.sourceAccessibility || "bookId" in patch) &&
      existing.sourceAccessibility !== derivedAccessibility
    ) {
      patch.sourceAccessibility = derivedAccessibility;
    }
  }

  const compatibilityScore = computeCompatibilityReputationScore({
    scholarlyInfluence,
    methodologicalRigor,
    corpusBreadth,
  });
  if (
    typeof compatibilityScore === "number" &&
    (overwrite ||
      existing.reputationScore === null ||
      "scholarlyInfluence" in patch ||
      "methodologicalRigor" in patch ||
      "corpusBreadth" in patch) &&
    existing.reputationScore !== compatibilityScore
  ) {
    patch.reputationScore = compatibilityScore;
  }
}

function patchToSnapshot(
  scholar: ScholarSnapshot,
  patch: Prisma.ScholarUpdateInput
): ScholarSnapshot {
  return {
    ...scholar,
    mufassirTr: (patch.mufassirTr as string | null | undefined) ?? scholar.mufassirTr,
    mufassirEn: (patch.mufassirEn as string | null | undefined) ?? scholar.mufassirEn,
    mufassirAr: (patch.mufassirAr as string | null | undefined) ?? scholar.mufassirAr,
    mufassirNameLong:
      (patch.mufassirNameLong as string | null | undefined) ?? scholar.mufassirNameLong,
    birthYear: (patch.birthYear as number | null | undefined) ?? scholar.birthYear,
    deathYear: (patch.deathYear as number | null | undefined) ?? scholar.deathYear,
    deathHijri: (patch.deathHijri as number | null | undefined) ?? scholar.deathHijri,
    century: (patch.century as number | null | undefined) ?? scholar.century,
    madhab: (patch.madhab as string | null | undefined) ?? scholar.madhab,
    period: (patch.period as string | null | undefined) ?? scholar.period,
    periodCode: (patch.periodCode as ScholarPeriod | null | undefined) ?? scholar.periodCode,
    environment: (patch.environment as string | null | undefined) ?? scholar.environment,
    originCountry: (patch.originCountry as string | null | undefined) ?? scholar.originCountry,
    bookId: (patch.bookId as string | null | undefined) ?? scholar.bookId,
    tafsirType1: (patch.tafsirType1 as string | null | undefined) ?? scholar.tafsirType1,
    tafsirType2: (patch.tafsirType2 as string | null | undefined) ?? scholar.tafsirType2,
    explanation: (patch.explanation as string | null | undefined) ?? scholar.explanation,
    detailInformation:
      (patch.detailInformation as string | null | undefined) ?? scholar.detailInformation,
    scholarlyInfluence:
      (patch.scholarlyInfluence as number | null | undefined) ?? scholar.scholarlyInfluence,
    methodologicalRigor:
      (patch.methodologicalRigor as number | null | undefined) ?? scholar.methodologicalRigor,
    corpusBreadth: (patch.corpusBreadth as number | null | undefined) ?? scholar.corpusBreadth,
    sourceAccessibility:
      (patch.sourceAccessibility as SourceAccessibility | null | undefined) ??
      scholar.sourceAccessibility,
    traditionAcceptance:
      (patch.traditionAcceptance as TraditionAcceptance[] | null | undefined) ??
      scholar.traditionAcceptance,
    reputationScore: (patch.reputationScore as number | null | undefined) ?? scholar.reputationScore,
  };
}

function toReferenceCreateInput(
  scholarId: string,
  reference: ScholarReferenceInput
): Prisma.ScholarReferenceCreateInput {
  return {
    scholar: { connect: { id: scholarId } },
    sourceType: normalizeNullableText(reference.sourceType)!,
    sourceTitle: normalizeNullableText(reference.sourceTitle)!,
    volume: normalizeNullableText(reference.volume),
    page: normalizeNullableText(reference.page),
    edition: normalizeNullableText(reference.edition),
    citationText: normalizeNullableText(reference.citationText),
    provenance: normalizeNullableText(reference.provenance),
    isPrimary: reference.isPrimary,
  };
}

async function main(): Promise<void> {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = parseCsv(raw);

  if (lines.length < 2) {
    console.log(
      JSON.stringify(
        {
          dryRun,
          allowOverwrite,
          csvPath: CSV_PATH,
          rows: 0,
          updatedRows: 0,
          touchedScholars: 0,
          insertedReferences: 0,
          duplicateReferencesSkipped: 0,
          skippedRows: 0,
          errors: 0,
        },
        null,
        2
      )
    );
    return;
  }

  const headers = lines[0].map((header) => normalizeHeader(header));
  const missingHeaders = expectedColumns.filter((column) => !headers.includes(column));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV missing required columns: ${missingHeaders.join(", ")}`);
  }

  const rows: CsvRow[] = lines
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const row: CsvRow = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = cells[i] ?? "";
      }
      return row;
    });

  const scholars = await prisma.scholar.findMany({
    select: {
      id: true,
      name: true,
      mufassirTr: true,
      mufassirEn: true,
      mufassirAr: true,
      mufassirNameLong: true,
      birthYear: true,
      deathYear: true,
      deathHijri: true,
      century: true,
      madhab: true,
      period: true,
      periodCode: true,
      environment: true,
      originCountry: true,
      bookId: true,
      tafsirType1: true,
      tafsirType2: true,
      explanation: true,
      detailInformation: true,
      scholarlyInfluence: true,
      methodologicalRigor: true,
      corpusBreadth: true,
      sourceAccessibility: true,
      traditionAcceptance: true,
      reputationScore: true,
    },
  });

  const scholarState = new Map<string, ScholarSnapshot>(
    scholars.map((scholar) => [scholar.id, { ...scholar }])
  );
  const scholarNameIndex = buildNameIndex(scholars);

  const existingReferences = await prisma.scholarReference.findMany({
    select: {
      scholarId: true,
      sourceType: true,
      sourceTitle: true,
      volume: true,
      page: true,
      edition: true,
      citationText: true,
    },
  });

  const referenceFingerprints = new Set<string>(
    existingReferences.map((reference) =>
      referenceFingerprint(reference.scholarId, {
        sourceType: reference.sourceType,
        sourceTitle: reference.sourceTitle,
        volume: reference.volume,
        page: reference.page,
        edition: reference.edition,
        citationText: reference.citationText,
      })
    )
  );

  let updatedRows = 0;
  let referenceRows = 0;
  let duplicateReferenceRows = 0;
  let skippedRows = 0;
  const touchedScholarIds = new Set<string>();
  const rowErrors: string[] = [];

  for (let index = 0; index < rows.length; index++) {
    const rowNumber = index + 2;
    const row = rows[index];

    try {
      const rawScholarId = normalizeNullableCsv(getColumn(row, "scholar_id", "id"));
      const rawScholarName = normalizeNullableCsv(
        getColumn(row, "scholar_name", "name", "mufassir_name")
      );

      let scholar: ScholarSnapshot | undefined;

      if (rawScholarId) {
        scholar = scholarState.get(rawScholarId) || scholarState.get(`scholar-${rawScholarId}`);
        if (!scholar) {
          throw new Error(`scholar not found by scholar_id "${rawScholarId}"`);
        }
      }

      if (!scholar && rawScholarName) {
        const matches = scholarNameIndex.get(normalizeLookup(rawScholarName)) || [];
        if (matches.length === 0) {
          throw new Error(`scholar not found by scholar_name "${rawScholarName}"`);
        }
        if (matches.length > 1) {
          throw new Error(
            `scholar_name "${rawScholarName}" is ambiguous (${matches.join(", ")}); use scholar_id`
          );
        }
        scholar = scholarState.get(matches[0]);
      }

      if (!scholar) {
        throw new Error("either scholar_id or scholar_name is required");
      }

      if (rawScholarName && normalizeLookup(rawScholarName) !== normalizeLookup(scholar.name)) {
        const knownNames = [
          scholar.name,
          scholar.mufassirTr,
          scholar.mufassirEn,
          scholar.mufassirAr,
          scholar.mufassirNameLong,
        ]
          .filter((value): value is string => Boolean(value))
          .map((value) => normalizeLookup(value));
        if (!knownNames.includes(normalizeLookup(rawScholarName))) {
          throw new Error(
            `scholar_name "${rawScholarName}" does not match scholar_id "${scholar.id}"`
          );
        }
      }

      const patchInput: ScholarPatchInput = {
        mufassirTr: normalizeNullableCsv(getColumn(row, "mufassir_tr")),
        mufassirEn: normalizeNullableCsv(getColumn(row, "mufassir_en")),
        mufassirAr: normalizeNullableCsv(getColumn(row, "mufassir_ar")),
        mufassirNameLong: normalizeNullableCsv(getColumn(row, "mufassir_name_long")),
        birthYear: parseOptionalInt(normalizeNullableCsv(getColumn(row, "birth_year"))),
        deathYear: parseOptionalInt(normalizeNullableCsv(getColumn(row, "death_year"))),
        deathHijri: parseOptionalInt(normalizeNullableCsv(getColumn(row, "death_hijri"))),
        madhab: normalizeNullableCsv(getColumn(row, "madhab")),
        environment: normalizeNullableCsv(getColumn(row, "environment")),
        originCountry: normalizeNullableCsv(getColumn(row, "origin_country")),
        bookId: normalizeNullableCsv(getColumn(row, "book_id")),
        tafsirType1: normalizeNullableCsv(getColumn(row, "tafsir_type1")),
        tafsirType2: normalizeNullableCsv(getColumn(row, "tafsir_type2")),
        explanation: normalizeNullableCsv(getColumn(row, "explanation")),
        detailInformation: normalizeNullableCsv(getColumn(row, "detail_information")),
      };

      const basePatch = buildScholarPatch(patchInput, scholar, allowOverwrite);
      const patch: Prisma.ScholarUpdateInput = { ...basePatch };

      const scholarlyInfluence = parseOptionalScore(
        normalizeNullableCsv(getColumn(row, "scholarly_influence")),
        "scholarly_influence"
      );
      const methodologicalRigor = parseOptionalScore(
        normalizeNullableCsv(getColumn(row, "methodological_rigor")),
        "methodological_rigor"
      );
      const corpusBreadth = parseOptionalScore(
        normalizeNullableCsv(getColumn(row, "corpus_breadth")),
        "corpus_breadth"
      );
      const sourceAccessibility = parseSourceAccessibility(
        normalizeNullableCsv(getColumn(row, "source_accessibility"))
      );
      const traditionAcceptance = parseTraditionAcceptance(
        normalizeNullableCsv(getColumn(row, "tradition_acceptance"))
      );

      if (scholarlyInfluence !== null && (allowOverwrite || !hasValue(scholar.scholarlyInfluence))) {
        patch.scholarlyInfluence = scholarlyInfluence;
      }
      if (
        methodologicalRigor !== null &&
        (allowOverwrite || !hasValue(scholar.methodologicalRigor))
      ) {
        patch.methodologicalRigor = methodologicalRigor;
      }
      if (corpusBreadth !== null && (allowOverwrite || !hasValue(scholar.corpusBreadth))) {
        patch.corpusBreadth = corpusBreadth;
      }
      if (
        sourceAccessibility !== null &&
        (allowOverwrite || !hasValue(scholar.sourceAccessibility))
      ) {
        patch.sourceAccessibility = sourceAccessibility;
      }
      if (
        traditionAcceptance &&
        traditionAcceptance.length > 0 &&
        (allowOverwrite || !hasValue(scholar.traditionAcceptance))
      ) {
        patch.traditionAcceptance = traditionAcceptance;
      }

      applyDerivations(patch, scholar, allowOverwrite);

      const reference: ScholarReferenceInput = {
        sourceType: normalizeNullableCsv(getColumn(row, "source_type")),
        sourceTitle: normalizeNullableCsv(getColumn(row, "source_title")),
        volume: normalizeNullableCsv(getColumn(row, "volume")),
        page: normalizeNullableCsv(getColumn(row, "page")),
        edition: normalizeNullableCsv(getColumn(row, "edition")),
        citationText: normalizeNullableCsv(getColumn(row, "citation_text")),
        provenance: normalizeNullableCsv(getColumn(row, "provenance")),
        isPrimary: parseOptionalBoolean(normalizeNullableCsv(getColumn(row, "is_primary"))) ?? true,
      };

      const patchFieldCount = Object.keys(patch).length;
      const shouldInsertReference = hasReferenceData(reference);

      if (patchFieldCount > 0) {
        const referenceErrors = validateReferenceRequirement(patch, reference);
        if (referenceErrors.length > 0) {
          throw new Error(referenceErrors.join("; "));
        }
      }

      if (shouldInsertReference) {
        const referenceErrors = validateReferenceRequirement({ referenceOnly: true }, reference);
        if (referenceErrors.length > 0) {
          throw new Error(referenceErrors.join("; "));
        }
      }

      let insertedReference = false;
      let pendingReferenceFingerprint: string | null = null;
      let pendingReferenceCreate: Prisma.ScholarReferenceCreateInput | null = null;

      if (shouldInsertReference) {
        const fingerprint = referenceFingerprint(scholar.id, reference);
        if (!referenceFingerprints.has(fingerprint)) {
          pendingReferenceFingerprint = fingerprint;
          pendingReferenceCreate = toReferenceCreateInput(scholar.id, reference);
        } else {
          duplicateReferenceRows++;
        }
      }

      if (!dryRun && (patchFieldCount > 0 || pendingReferenceCreate)) {
        await prisma.$transaction(async (tx) => {
          if (patchFieldCount > 0) {
            await tx.scholar.update({
              where: { id: scholar.id },
              data: patch,
            });
          }
          if (pendingReferenceCreate) {
            await tx.scholarReference.create({ data: pendingReferenceCreate });
          }
        });
      }

      if (pendingReferenceFingerprint) {
        insertedReference = true;
        referenceFingerprints.add(pendingReferenceFingerprint);
        referenceRows++;
      }

      if (patchFieldCount > 0) {
        updatedRows++;
        touchedScholarIds.add(scholar.id);
        scholarState.set(scholar.id, patchToSnapshot(scholar, patch));
      } else if (!insertedReference) {
        skippedRows++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rowErrors.push(`row ${rowNumber}: ${message}`);
    }
  }

  const summary = {
    dryRun,
    allowOverwrite,
    csvPath: CSV_PATH,
    rows: rows.length,
    updatedRows,
    touchedScholars: touchedScholarIds.size,
    insertedReferences: referenceRows,
    duplicateReferencesSkipped: duplicateReferenceRows,
    skippedRows,
    errors: rowErrors.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (rowErrors.length > 0) {
    for (const error of rowErrors.slice(0, 50)) {
      console.error(error);
    }
    if (rowErrors.length > 50) {
      console.error(`... ${rowErrors.length - 50} more errors`);
    }
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("Scholar enrichment import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
