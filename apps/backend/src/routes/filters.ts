import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

// Public endpoint to get available filters
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Get all scholars for filtering
    const scholars = await prisma.scholar.findMany({
      select: {
        id: true,
        name: true,
        birthYear: true,
        deathYear: true,
        century: true,
        madhab: true,
        period: true,
        environment: true,
        originCountry: true,
        reputationScore: true
      },
      orderBy: { name: 'asc' }
    });

    // Get unique values for filter options
    const centuries = [...new Set(scholars.map((s: { century: number }) => s.century))].sort();
    const birthYears = scholars.map((s: any) => s.birthYear).filter((n: any) => typeof n === 'number');
    const deathYears = scholars.map((s: any) => s.deathYear).filter((n: any) => typeof n === 'number');
    const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
    const madhabs = [...new Set(scholars.map((s: { madhab: string | null }) => s.madhab).filter(isString))].sort();
    const periods = [...new Set(scholars.map((s: { period: string | null }) => s.period).filter(isString))].sort();
    const environments = [...new Set(scholars.map((s: { environment: string | null }) => s.environment).filter(isString))].sort();
    const countries = [...new Set(scholars.map((s: { originCountry: string | null }) => s.originCountry).filter(isString))].sort();

    const response = {
      scholars,
      filterOptions: {
        centuries,
        madhabs,
        periods,
        environments,
        countries,
        birthYearRange: birthYears.length ? { min: Math.min(...birthYears), max: Math.max(...birthYears) } : null,
        deathYearRange: deathYears.length ? { min: Math.min(...deathYears), max: Math.max(...deathYears) } : null
      },
      toneRange: { min: 1, max: 10, description: "Emotional vs Rational tone" },
      intellectRange: { min: 1, max: 10, description: "Vocabulary richness and intellectual level" },
      supportedLanguages: ["Turkish", "English", "Arabic"]
    };

    res.json(response);
  } catch (error) {
    console.error("Filters error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router; 
