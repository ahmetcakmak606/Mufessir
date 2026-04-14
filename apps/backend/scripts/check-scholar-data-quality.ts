#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const strict = process.env.STRICT === "1";
const expectScholarCount = Number(process.env.EXPECT_SCHOLAR_COUNT || 0);
const requiredCoverage = Number(process.env.REQUIRED_COVERAGE || 0.9);

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function inRange1to5(value: number | null | undefined): boolean {
  if (value == null) return true;
  return value >= 1 && value <= 5;
}

async function main() {
  const scholars = await prisma.mufassir.findMany({
    select: {
      id: true,
      nameEn: true,
      nameTr: true,
      bookId: true,
      explanation: true,
      detailInformation: true,
      tafsirType1: true,
      century: true,
      periodCode: true,
      madhab: true,
      environment: true,
      originCountry: true,
      sourceAccessibility: true,
      scholarlyInfluence: true,
      methodologicalRigor: true,
      corpusBreadth: true,
    },
  });

  const references = await prisma.tafsir.count();
  const total = scholars.length;
  const requiredFields: Array<keyof (typeof scholars)[number]> = [
    "nameTr",
    "bookId",
    "explanation",
    "detailInformation",
    "tafsirType1",
    "periodCode",
    "madhab",
    "environment",
    "originCountry",
    "sourceAccessibility",
  ];

  const coverage = requiredFields.map((field) => {
    const filled = scholars.filter((s) => {
      const value = s[field];
      if (typeof value === "number") return Number.isFinite(value);
      return typeof value === "string"
        ? value.trim().length > 0
        : value !== null && value !== undefined;
    }).length;
    return { field, filled, total, ratio: ratio(filled, total) };
  });

  const invalidProfileRows = scholars.filter(
    (s) =>
      !inRange1to5(s.scholarlyInfluence) ||
      !inRange1to5(s.methodologicalRigor) ||
      !inRange1to5(s.corpusBreadth)
  );

  const duplicateBookIds = new Map<string, string[]>();
  for (const s of scholars) {
    const bookId = s.bookId?.trim();
    if (!bookId) continue;
    const arr = duplicateBookIds.get(bookId) || [];
    arr.push(s.id);
    duplicateBookIds.set(bookId, arr);
  }
  const duplicateBookIdRows = Array.from(duplicateBookIds.entries()).filter(
    ([, ids]) => ids.length > 1
  );

  const dependencyReport = {
    t01_data_enrichment_ready: coverage.find((c) => c.field === "nameTr")?.ratio ?? 0,
    t01a_metadata_ready:
      (coverage.find((c) => c.field === "periodCode")?.ratio ?? 0) *
      (coverage.find((c) => c.field === "madhab")?.ratio ?? 0),
    t01b_book_id_ready: coverage.find((c) => c.field === "bookId")?.ratio ?? 0,
    t02_reference_count: references,
  };

  const report = {
    scholars: total,
    references,
    expectScholarCount,
    requiredCoverage,
    strict,
    coverage,
    invalidProfileRows: invalidProfileRows.length,
    duplicateBookIdCount: duplicateBookIdRows.length,
    dependencyReport,
  };

  console.log(JSON.stringify(report, null, 2));

  const belowCoverage = coverage.filter((item) => item.ratio < requiredCoverage);
  const hardFailures: string[] = [];
  if (expectScholarCount > 0 && total < expectScholarCount) {
    hardFailures.push(`scholar_count ${total} < expected ${expectScholarCount}`);
  }
  if (invalidProfileRows.length > 0) {
    hardFailures.push(
      `invalid_reputation_profile_rows=${invalidProfileRows.length} (must be 1..5)`
    );
  }
  if (duplicateBookIdRows.length > 0) {
    hardFailures.push(`duplicate_book_id_groups=${duplicateBookIdRows.length}`);
  }
  if (strict && belowCoverage.length > 0) {
    hardFailures.push(
      `coverage_below_threshold=${belowCoverage.map((x) => x.field).join(",")}`
    );
  }

  if (hardFailures.length) {
    console.error("Quality gate failed:", hardFailures.join(" | "));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("Quality gate failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
