#!/usr/bin/env tsx
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const OUTPUT_PATH =
  process.env.SCHOLAR_ENRICHMENT_STARTER_PATH ||
  resolve(__dirname, "../../../docs/SCHOLAR_ENRICHMENT_STARTER.csv");

const HEADER = [
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

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main(): Promise<void> {
  const scholars = await prisma.scholar.findMany({
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const rows: string[] = [HEADER.join(",")];

  for (const scholar of scholars) {
    const record = {
      scholar_id: scholar.id,
      scholar_name: scholar.name,
      mufassir_tr: "",
      mufassir_en: "",
      mufassir_ar: "",
      mufassir_name_long: "",
      birth_year: "",
      death_year: "",
      death_hijri: "",
      madhab: "",
      environment: "",
      origin_country: "",
      book_id: "",
      tafsir_type1: "",
      tafsir_type2: "",
      explanation: "",
      detail_information: "",
      scholarly_influence: "",
      methodological_rigor: "",
      corpus_breadth: "",
      tradition_acceptance: "",
      source_accessibility: "",
      source_type: "",
      source_title: "",
      volume: "",
      page: "",
      edition: "",
      citation_text: "",
      provenance: "",
      is_primary: "",
    };

    const line = HEADER.map((column) => escapeCsv(record[column])).join(",");
    rows.push(line);
  }

  writeFileSync(OUTPUT_PATH, `${rows.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        scholars: scholars.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Starter CSV export failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
