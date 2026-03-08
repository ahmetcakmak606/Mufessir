#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  computeCompatibilityReputationScore,
  deriveCenturyFromHijri,
  derivePeriodCode,
  deriveSourceAccessibility,
} from "../src/utils/scholar-metadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const dryRun = process.env.DRY_RUN === "1";

async function main() {
  const scholars = await prisma.scholar.findMany({
    select: {
      id: true,
      deathHijri: true,
      century: true,
      periodCode: true,
      period: true,
      bookId: true,
      sourceAccessibility: true,
      scholarlyInfluence: true,
      methodologicalRigor: true,
      corpusBreadth: true,
      reputationScore: true,
    },
  });

  let updated = 0;
  for (const s of scholars) {
    const nextCentury = deriveCenturyFromHijri(s.deathHijri);
    const nextPeriodCode = derivePeriodCode(s.deathHijri);
    const nextSourceAccessibility =
      s.sourceAccessibility ?? deriveSourceAccessibility(s.bookId);
    const nextCompatibilityScore = computeCompatibilityReputationScore({
      scholarlyInfluence: s.scholarlyInfluence,
      methodologicalRigor: s.methodologicalRigor,
      corpusBreadth: s.corpusBreadth,
    });

    const patch: Record<string, unknown> = {};
    if (typeof nextCentury === "number" && s.century !== nextCentury) {
      patch.century = nextCentury;
    }
    if (nextPeriodCode && s.periodCode !== nextPeriodCode) {
      patch.periodCode = nextPeriodCode;
    }
    if (!s.period && nextPeriodCode) {
      patch.period = nextPeriodCode;
    }
    if (nextSourceAccessibility && s.sourceAccessibility !== nextSourceAccessibility) {
      patch.sourceAccessibility = nextSourceAccessibility;
    }
    if (
      typeof nextCompatibilityScore === "number" &&
      s.reputationScore !== nextCompatibilityScore
    ) {
      patch.reputationScore = nextCompatibilityScore;
    }

    if (Object.keys(patch).length > 0) {
      updated++;
      if (!dryRun) {
        await prisma.scholar.update({
          where: { id: s.id },
          data: patch,
        });
      }
    }
  }

  console.log(
    dryRun
      ? `[dry-run] ${updated} scholar rows require derivation updates`
      : `Updated ${updated} scholar rows with derived metadata`
  );
}

main()
  .catch((error) => {
    console.error("Derivation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

