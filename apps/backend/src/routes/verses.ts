import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

// GET /verses?surahNumber=1&verseNumber=1 → returns a single verse by composite key
router.get("/", async (req: Request, res: Response) => {
  try {
    const surahNumber = req.query.surahNumber ? Number(req.query.surahNumber) : undefined;
    const verseNumber = req.query.verseNumber ? Number(req.query.verseNumber) : undefined;

    if (surahNumber && verseNumber) {
      const verse = await prisma.verse.findFirst({
        where: { surahNumber, verseNumber },
      });
      if (!verse) return res.status(404).json({ error: "Verse not found" });
      return res.json(verse);
    }

    // Optional: search by q in arabicText or translation (basic contains match)
    const q = (req.query.q as string) || "";
    const take = Math.min(Number(req.query.take) || 20, 100);
    const skip = Number(req.query.skip) || 0;

    if (q) {
      const verses = await prisma.verse.findMany({
        where: {
          OR: [
            { arabicText: { contains: q } },
            { translation: { contains: q } },
          ],
        },
        orderBy: [{ surahNumber: "asc" }, { verseNumber: "asc" }],
        skip,
        take,
      });
      return res.json({ items: verses, total: verses.length, skip, take });
    }

    // Default: list first N verses for quick pickers
    const verses = await prisma.verse.findMany({
      orderBy: [{ surahNumber: "asc" }, { verseNumber: "asc" }],
      skip,
      take,
    });
    return res.json({ items: verses, total: verses.length, skip, take });
  } catch (error) {
    console.error("Verses route error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;


