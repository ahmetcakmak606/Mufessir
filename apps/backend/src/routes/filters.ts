import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma.js";

const router: Router = Router();

// Public endpoint to get available filters
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Get all mufassirs for filtering
    const mufassirs = await prisma.mufassir.findMany({
      select: {
        id: true,
        nameEn: true,
        nameTr: true,
        nameAr: true,
        nameLong: true,
        deathMiladi: true,
        deathHijri: true,
        century: true,
        madhab: true,
        period: true,
        environment: true,
        originCountry: true,
        reputationScore: true,
        bookId: true,
        tafsirType1: true,
        tafsirType2: true,
        bookTafsir: true,
      },
      orderBy: { nameEn: "asc" },
    });

    // Get unique values for filter options
    const isString = (v: unknown): v is string =>
      typeof v === "string" && v.length > 0;
    const centuries = [
      ...new Set(
        mufassirs
          .map((m: { century: number | null }) => m.century)
          .filter((c: number | null): c is number => c !== null),
      ),
    ].sort();
    const deathYears = mufassirs
      .map((m: any) => m.deathMiladi)
      .filter((n: any) => typeof n === "number");
    const deathHijriYears = mufassirs
      .map((m: any) => m.deathHijri)
      .filter((n: any) => typeof n === "number");
    const madhabs = [
      ...new Set(
        mufassirs
          .map((m: { madhab: string | null }) => m.madhab)
          .filter(isString),
      ),
    ].sort();
    const periods = [
      ...new Set(
        mufassirs
          .map((m: { period: string | null }) => m.period)
          .filter(isString),
      ),
    ].sort();
    const environments = [
      ...new Set(
        mufassirs
          .map((m: { environment: string | null }) => m.environment)
          .filter(isString),
      ),
    ].sort();
    const countries = [
      ...new Set(
        mufassirs
          .map((m: { originCountry: string | null }) => m.originCountry)
          .filter(isString),
      ),
    ].sort();
    const tafsirTypes = [
      ...new Set(
        [
          ...mufassirs.map((m: any) => m.tafsirType1),
          ...mufassirs.map((m: any) => m.tafsirType2),
        ].filter(isString),
      ),
    ].sort();

    const response = {
      scholars: mufassirs,
      filterOptions: {
        centuries,
        madhabs,
        periods,
        environments,
        countries,
        tafsirTypes,
        deathYearRange: deathYears.length
          ? { min: Math.min(...deathYears), max: Math.max(...deathYears) }
          : null,
        deathHijriRange: deathHijriYears.length
          ? {
              min: Math.min(...deathHijriYears),
              max: Math.max(...deathHijriYears),
            }
          : null,
      },
      toneRange: { min: 1, max: 10, description: "Emotional vs Rational tone" },
      intellectRange: {
        min: 1,
        max: 10,
        description: "Vocabulary richness and intellectual level",
      },
      supportedLanguages: ["Turkish", "English", "Arabic"],
    };

    res.json(response);
  } catch (error) {
    console.error("Filters error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
