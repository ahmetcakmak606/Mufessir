import { Router } from "express";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  authenticateJWT,
  enforceQuota,
  decrementQuota,
} from "../middleware/auth.js";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  generateTafsirStream,
  generateTafsirNonStreaming,
} from "../utils/openai.js";
import { buildTafsirPrompt, type ScholarMeta } from "../utils/prompt.js";
import { finalizeResponse } from "../utils/text.js";
import { performSimilaritySearch } from "../utils/similarity-search.js";
import { findMostSimilarTafsir } from "../utils/similarity-calculation.js";
import {
  computeConfidenceScore,
  deriveProvenanceIndicator,
  type Citation,
  type SourceExcerpt,
} from "../utils/citations.js";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

// Optional DEMO mode: serve precomputed tafsir for selected verses
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const demoMode = process.env.DEMO_MODE === "1";
let demoMap: Record<string, { language: string; content: string }[]> = {};
if (demoMode) {
  try {
    const demoPath = resolve(__dirname, "../..", "scripts", "demo-tafsir.json");
    const raw = readFileSync(demoPath, "utf8");
    demoMap = JSON.parse(raw);
    console.log(
      "DEMO_MODE enabled. Loaded",
      Object.keys(demoMap).length,
      "precomputed entries",
    );
  } catch (e) {
    console.warn(
      "DEMO_MODE enabled but demo-tafsir.json not found or invalid.",
    );
  }
}

type RunMeta = {
  title: string | null;
  notes: string | null;
  starred: boolean;
  updatedAt: string | null;
};

const DEFAULT_RUN_META: RunMeta = {
  title: null,
  notes: null,
  starred: false,
  updatedAt: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractFiltersFromQuery(
  queryValue: Prisma.JsonValue | null,
): Record<string, unknown> {
  const queryObj = asRecord(queryValue);
  return asRecord(queryObj.filters);
}

function extractRunMeta(queryValue: Prisma.JsonValue | null): RunMeta {
  const queryObj = asRecord(queryValue);
  const meta = asRecord(queryObj.runMeta);
  return {
    title: typeof meta.title === "string" ? meta.title : null,
    notes: typeof meta.notes === "string" ? meta.notes : null,
    starred: typeof meta.starred === "boolean" ? meta.starred : false,
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : null,
  };
}

function parseStoredCitations(value: Prisma.JsonValue | null): Citation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter(
      (row) =>
        typeof row.scholarId === "string" &&
        typeof row.scholarName === "string",
    )
    .map((row) => ({
      scholarId: String(row.scholarId),
      scholarName: String(row.scholarName),
      sourceType:
        typeof row.sourceType === "string" ? row.sourceType : "UNKNOWN",
      sourceTitle:
        typeof row.sourceTitle === "string"
          ? row.sourceTitle
          : "Unknown source",
      volume: typeof row.volume === "string" ? row.volume : null,
      page: typeof row.page === "string" ? row.page : null,
      edition: typeof row.edition === "string" ? row.edition : null,
      citationText:
        typeof row.citationText === "string" ? row.citationText : null,
      provenance: typeof row.provenance === "string" ? row.provenance : null,
      isPrimary: Boolean(row.isPrimary),
    }));
}

function buildRunSummary(search: any) {
  const latest = search.results?.[0];
  const citations = parseStoredCitations(latest?.citations ?? null);
  const runMeta = extractRunMeta(search.query as Prisma.JsonValue | null);
  const updatedAt = runMeta.updatedAt || latest?.createdAt || search.createdAt;
  return {
    runId: search.id,
    searchId: search.id,
    verse: {
      id: search.verse.id,
      surahNumber: search.verse.surahNumber,
      surahName: search.verse.surahName,
      verseNumber: search.verse.verseNumber,
    },
    filters: extractFiltersFromQuery(search.query as Prisma.JsonValue | null),
    title: runMeta.title,
    notes: runMeta.notes,
    starred: runMeta.starred,
    aiResponsePreview:
      typeof latest?.aiResponse === "string"
        ? latest.aiResponse.slice(0, 220).trim()
        : null,
    confidence:
      typeof latest?.confidenceScore === "number"
        ? latest.confidenceScore
        : null,
    provenance: deriveProvenanceIndicator(citations),
    citationsCount: citations.length,
    createdAt: search.createdAt,
    updatedAt,
  };
}

router.get("/runs", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const parsedLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(50, Math.max(1, Math.floor(parsedLimit)))
      : 20;

    const rows = await prisma.search.findMany({
      where: { userId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        verse: {
          select: {
            id: true,
            surahNumber: true,
            surahName: true,
            verseNumber: true,
          },
        },
        results: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            aiResponse: true,
            confidenceScore: true,
            citations: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      items: pageItems.map(buildRunSummary),
      nextCursor: hasMore
        ? (pageItems[pageItems.length - 1]?.id ?? null)
        : null,
    });
  } catch (error) {
    console.error("Runs list error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/runs/:runId", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const runId = req.params.runId;
    if (!runId) {
      return res.status(400).json({ error: "runId is required" });
    }

    const search = await prisma.search.findFirst({
      where: { id: runId, userId },
      include: {
        verse: {
          select: {
            id: true,
            surahNumber: true,
            surahName: true,
            verseNumber: true,
            arabicText: true,
            translation: true,
          },
        },
        results: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            tafsir: {
              include: {
                scholar: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!search) {
      return res.status(404).json({ error: "Run not found" });
    }

    const latest = search.results[0];
    const citations = parseStoredCitations(
      (latest?.citations ?? null) as Prisma.JsonValue | null,
    );
    const runMeta = extractRunMeta(search.query as Prisma.JsonValue | null);
    const updatedAt =
      runMeta.updatedAt || latest?.createdAt || search.createdAt;
    const sourceExcerpts: SourceExcerpt[] =
      latest?.tafsir?.tafsirText && latest?.tafsir?.scholar
        ? [
            {
              scholarId: latest.tafsir.scholar.id,
              scholarName: latest.tafsir.scholar.name,
              excerpt:
                latest.tafsir.tafsirText.length > 240
                  ? `${latest.tafsir.tafsirText.slice(0, 240)}...`
                  : latest.tafsir.tafsirText,
            },
          ]
        : [];

    return res.json({
      runId: search.id,
      searchId: search.id,
      verse: search.verse,
      filters: extractFiltersFromQuery(search.query as Prisma.JsonValue | null),
      title: runMeta.title,
      notes: runMeta.notes,
      starred: runMeta.starred,
      aiResponse: latest?.aiResponse ?? "",
      confidence:
        typeof latest?.confidenceScore === "number"
          ? latest.confidenceScore
          : null,
      provenance: deriveProvenanceIndicator(citations),
      citations,
      sourceExcerpts,
      createdAt: search.createdAt,
      updatedAt,
    });
  } catch (error) {
    console.error("Run detail error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/runs/:runId", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const runId = req.params.runId;
    if (!runId) {
      return res.status(400).json({ error: "runId is required" });
    }

    const { title, starred, notes } = req.body as {
      title?: unknown;
      starred?: unknown;
      notes?: unknown;
    };
    const hasTitle = title !== undefined;
    const hasStarred = starred !== undefined;
    const hasNotes = notes !== undefined;
    if (!hasTitle && !hasStarred && !hasNotes) {
      return res.status(400).json({ error: "At least one field is required" });
    }

    if (hasTitle && title !== null && typeof title !== "string") {
      return res.status(400).json({ error: "title must be a string or null" });
    }
    if (hasNotes && notes !== null && typeof notes !== "string") {
      return res.status(400).json({ error: "notes must be a string or null" });
    }
    if (hasStarred && typeof starred !== "boolean") {
      return res.status(400).json({ error: "starred must be boolean" });
    }

    const search = await prisma.search.findFirst({
      where: { id: runId, userId },
    });
    if (!search) {
      return res.status(404).json({ error: "Run not found" });
    }

    const currentQuery = asRecord(search.query as Prisma.JsonValue | null);
    const currentMeta = extractRunMeta(search.query as Prisma.JsonValue | null);
    const nextMeta: RunMeta = {
      ...currentMeta,
      ...(hasTitle
        ? {
            title:
              typeof title === "string"
                ? title.trim().slice(0, 120) || null
                : null,
          }
        : {}),
      ...(hasNotes
        ? {
            notes:
              typeof notes === "string"
                ? notes.trim().slice(0, 4000) || null
                : null,
          }
        : {}),
      ...(hasStarred ? { starred: Boolean(starred) } : {}),
      updatedAt: new Date().toISOString(),
    };

    const updatedQuery: Prisma.InputJsonValue = {
      ...currentQuery,
      runMeta: nextMeta,
    };

    const updated = await prisma.search.update({
      where: { id: runId },
      data: { query: updatedQuery },
      include: {
        verse: {
          select: {
            id: true,
            surahNumber: true,
            surahName: true,
            verseNumber: true,
          },
        },
        results: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            aiResponse: true,
            confidenceScore: true,
            citations: true,
            createdAt: true,
          },
        },
      },
    });

    return res.json(buildRunSummary(updated));
  } catch (error) {
    console.error("Run update error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function buildSourceExcerpts(similarTafsirs: any[]): SourceExcerpt[] {
  return similarTafsirs.slice(0, 3).map((result: any) => ({
    scholarId: result.scholar.id,
    scholarName: result.scholar.name,
    excerpt:
      result.tafsirText.length > 240
        ? `${result.tafsirText.slice(0, 240)}...`
        : result.tafsirText,
  }));
}

async function loadCitations(
  prismaClient: PrismaClient,
  similarTafsirs: any[],
): Promise<Citation[]> {
  const scholarIds = [
    ...new Set(similarTafsirs.map((result: any) => result.scholar.id)),
  ];
  if (!scholarIds.length) return [];

  const rows = await prismaClient.scholarReference.findMany({
    where: { scholarId: { in: scholarIds } },
    include: {
      scholar: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { isPrimary: "desc" },
      { sourceType: "asc" },
      { sourceTitle: "asc" },
    ],
    take: 20,
  });

  return rows.map((row) => ({
    scholarId: row.scholarId,
    scholarName: row.scholar.name,
    sourceType: row.sourceType,
    sourceTitle: row.sourceTitle,
    volume: row.volume,
    page: row.page,
    edition: row.edition,
    citationText: row.citationText,
    provenance: row.provenance,
    isPrimary: row.isPrimary,
  }));
}

// Protected endpoint that requires auth and enforces quota
router.post(
  "/",
  authenticateJWT,
  enforceQuota(prisma),
  decrementQuota(prisma),
  async (req, res) => {
    try {
      const {
        verseId,
        filters,
        stream = false,
      } = req.body as {
        verseId: string;
        filters?: {
          scholars?: string[];
          excludeScholars?: string[];
          tone?: number; // 1-10 emotional vs rational
          intellectLevel?: number; // 1-10 vocabulary richness
          language?: string;
          responseLength?: number; // 1-10 desired length (short->long)
        };
        stream?: boolean;
      };

      if (!verseId) {
        return res.status(400).json({ error: "Verse ID is required" });
      }

      // Get verse details
      const verse = await prisma.verse.findUnique({
        where: { id: verseId },
      });

      if (!verse) {
        return res.status(404).json({ error: "Verse not found" });
      }

      // Build search query from verse text
      const searchQuery =
        `${verse.arabicText} ${verse.translation || ""}`.trim();

      // Perform vector similarity search to find relevant tafsirs
      // ALWAYS filter by verseId - semantic search should only find tafsirs FOR the queried verse
      let similarTafsirs = [];
      try {
        similarTafsirs = await performSimilaritySearch(prisma, {
          query: searchQuery,
          verseId: verseId, // Always filter by verseId to prevent cross-verse retrieval
          scholarIds: filters?.scholars,
          excludeScholarIds: filters?.excludeScholars,
          limit: 5,
          minSimilarity: 0.3,
        });
      } catch (searchError) {
        console.error("Similarity search error:", searchError);
        // If similarity search fails, get sample tafsirs as fallback
        const sampleTafsirs = await prisma.tafsir.findMany({
          where: { verseId },
          include: {
            scholar: true,
            verse: true,
          },
          take: 3,
        });

        similarTafsirs = sampleTafsirs.map((tafsir: any) => ({
          tafsirId: tafsir.id,
          scholarName: tafsir.scholar.name,
          tafsirText: tafsir.tafsirText,
          similarityScore: 0.7, // Mock similarity score
          verseId: tafsir.verseId,
          surahNumber: tafsir.verse.surahNumber,
          verseNumber: tafsir.verse.verseNumber,
          scholar: {
            id: tafsir.scholar.id,
            name: tafsir.scholar.name,
            century: tafsir.scholar.century,
            madhab: tafsir.scholar.madhab,
            period: tafsir.scholar.period,
            environment: tafsir.scholar.environment,
            originCountry: tafsir.scholar.originCountry,
            reputationScore: tafsir.scholar.reputationScore,
          },
        }));
      }

      // Validate that retrieved sources are from the queried verse
      // This catches edge cases where vector search might return wrong results
      const sourceVerseMatch = similarTafsirs.every(
        (t: any) => t.verseId === verseId,
      );

      // Log warning if source-verse mismatch detected
      if (!sourceVerseMatch) {
        console.warn(
          `Source-verse mismatch detected! Query verse: ${verseId}, ` +
            `Retrieved verses: ${[...new Set(similarTafsirs.map((t: any) => t.verseId))].join(", ")}`,
        );
      }

      // Build prompt options (clip excerpts for cost and speed)
      const citations = await loadCitations(prisma, similarTafsirs);
      const sourceExcerpts = buildSourceExcerpts(similarTafsirs);
      const provenance = deriveProvenanceIndicator(citations);

      // Extract Arabic terms/phrases from source excerpts for similarity boosting
      // These will be included in prompt to encourage verbatim usage
      const extractArabicTerms = (text: string): string[] => {
        const arabicPattern = /[\u0600-\u06FF]+/g;
        const matches = text.match(arabicPattern) || [];
        // Filter for meaningful terms (3+ chars, not just particles)
        const meaningfulTerms = matches.filter((t) => t.length >= 3);
        // Get unique terms, preferring longer ones
        const unique = [...new Set(meaningfulTerms)];
        return unique.sort((a, b) => b.length - a.length).slice(0, 10);
      };

      const allArabicTerms = similarTafsirs.flatMap((t: any) =>
        extractArabicTerms(t.tafsirText),
      );
      const keyArabicTerms = [...new Set(allArabicTerms)].slice(0, 15);

      const promptOptions = {
        verseText: verse.arabicText,
        translation: verse.translation || undefined,
        tafsirExcerpts: similarTafsirs.slice(0, 3).map((result: any) => ({
          scholar: {
            name: result.scholar.name,
            century: result.scholar.century,
            madhab: result.scholar.madhab || undefined,
            period: result.scholar.period || undefined,
            environment: result.scholar.environment || undefined,
            originCountry: result.scholar.originCountry || undefined,
            reputationScore: result.scholar.reputationScore || undefined,
          } as ScholarMeta,
          excerpt:
            result.tafsirText.length > 300
              ? result.tafsirText.substring(0, 300) + "..."
              : result.tafsirText,
        })),
        citations: citations.slice(0, 8).map((citation) => ({
          scholarName: citation.scholarName,
          sourceTitle: citation.sourceTitle,
          sourceType: citation.sourceType,
          volume: citation.volume,
          page: citation.page,
        })),
        arabicTerms: keyArabicTerms,
        userParams: {
          tone: filters?.tone,
          intellectLevel: filters?.intellectLevel,
          language: filters?.language || "Turkish",
        },
      };

      // Check for existing cached results using a stable cacheKey
      const cacheKey = JSON.stringify({
        verseId,
        filters: filters || {},
        userId: (req as any).user!.id,
      });

      const existingSearch = await prisma.search.findFirst({
        where: {
          userId: (req as any).user!.id,
          verseId,
          query: {
            path: ["cacheKey"],
            equals: cacheKey,
          },
        },
        include: {
          results: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // If we have a recent cached result (within 1 hour), return it
      if (
        existingSearch?.results[0] &&
        new Date().getTime() - existingSearch.createdAt.getTime() <
          60 * 60 * 1000
      ) {
        const cachedResult = existingSearch.results[0];
        const cachedCitations = Array.isArray(cachedResult.citations)
          ? (cachedResult.citations as unknown as Citation[])
          : citations;
        const cachedConfidence =
          typeof cachedResult.confidenceScore === "number"
            ? cachedResult.confidenceScore
            : computeConfidenceScore({
                similarityScores: [cachedResult.similarityScore || 0],
                citationCount: cachedCitations.length,
                excerptCount: sourceExcerpts.length,
                sourceVerseMatch: true, // Cached results assumed valid
              });
        const cachedProvenance = deriveProvenanceIndicator(cachedCitations);
        console.log("Returning cached result for search:", existingSearch.id);

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

          res.write(
            `data: ${JSON.stringify({ type: "start", searchId: existingSearch.id, runId: existingSearch.id, cached: true })}\n\n`,
          );
          res.write(
            `data: ${JSON.stringify({ type: "chunk", content: cachedResult.aiResponse })}\n\n`,
          );
          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              searchId: existingSearch.id,
              runId: existingSearch.id,
              cached: true,
              confidence: cachedConfidence,
              provenance: cachedProvenance,
              citations: cachedCitations,
              sourceExcerpts,
            })}\n\n`,
          );
          res.end();
        } else {
          return res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: verse.surahName,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation,
            },
            filters,
            aiResponse: cachedResult.aiResponse,
            similarityScore: cachedResult.similarityScore,
            confidence: cachedConfidence,
            provenance: cachedProvenance,
            citations: cachedCitations,
            sourceExcerpts,
            searchId: existingSearch.id,
            runId: existingSearch.id,
            usage: null,
            cached: true,
          });
        }
        return;
      }

      // DEMO mode: if precomputed exists, short-circuit with cached content
      if (demoMode) {
        const items = demoMap[verseId];
        const targetLang = (filters?.language || "Turkish").toLowerCase();
        const match =
          items?.find(
            (x) => (x.language || "Turkish").toLowerCase() === targetLang,
          ) || items?.[0];
        if (match) {
          const confidence = computeConfidenceScore({
            similarityScores: similarTafsirs.map(
              (item: any) => item.similarityScore || 0,
            ),
            citationCount: citations.length,
            excerptCount: sourceExcerpts.length,
            sourceVerseMatch,
          });
          if (stream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

            res.write(
              `data: ${JSON.stringify({ type: "start", searchId: "demo", runId: "demo" })}\n\n`,
            );

            const requestedLang = filters?.language || "Turkish";
            const translationLabel =
              requestedLang === "Turkish" ? "Meal" : "Meaning";
            const tafsirHeader =
              requestedLang === "Turkish" ? "Tefsir" : "Tafsir";
            const prefaceLines = [
              `Arabic: ${verse.arabicText}`,
              verse.translation
                ? `${translationLabel}: ${verse.translation}`
                : undefined,
              "",
              `${tafsirHeader}:`,
              "",
            ]
              .filter(Boolean)
              .join("\n");
            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: prefaceLines + "\n" })}\n\n`,
            );

            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: match.content })}\n\n`,
            );
            res.write(
              `data: ${JSON.stringify({
                type: "complete",
                searchId: "demo",
                runId: "demo",
                cached: true,
                usage: { totalTokens: 0 },
                confidence,
                provenance,
                citations,
                sourceExcerpts,
              })}\n\n`,
            );
            res.end();
            return;
          } else {
            return res.json({
              verse: {
                id: verse.id,
                surahNumber: verse.surahNumber,
                surahName: verse.surahName,
                verseNumber: verse.verseNumber,
                arabicText: verse.arabicText,
                translation: verse.translation,
              },
              filters,
              aiResponse: match.content,
              similarityScore: null,
              confidence,
              provenance,
              citations,
              sourceExcerpts,
              searchId: "demo",
              runId: "demo",
              usage: { totalTokens: 0 },
              cached: true,
              demo: true,
            });
          }
        }
      }

      // Create new search record
      const search = await prisma.search.create({
        data: {
          userId: (req as any).user!.id,
          verseId,
          query: {
            filters,
            verseId,
            cacheKey,
            timestamp: new Date().toISOString(),
          },
        },
      });

      let aiResponse = "";
      let similarityScore = null;

      try {
        if (stream) {
          // Stream the response using Server-Sent Events
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

          // Send initial data
          res.write(
            `data: ${JSON.stringify({ type: "start", searchId: search.id, runId: search.id })}\n\n`,
          );

          // Send verse preface first: Arabic, then translation line, then Tefsir/Tafsir header
          const requestedLang = filters?.language || "Turkish";
          const translationLabel =
            requestedLang === "Turkish" ? "Meal" : "Meaning";
          const tafsirHeader =
            requestedLang === "Turkish" ? "Tefsir" : "Tafsir";
          const prefaceLines = [
            `Arabic: ${verse.arabicText}`,
            verse.translation
              ? `${translationLabel}: ${verse.translation}`
              : undefined,
            "",
            `${tafsirHeader}:`,
            "",
          ]
            .filter(Boolean)
            .join("\n");
          res.write(
            `data: ${JSON.stringify({ type: "chunk", content: prefaceLines + "\n" })}\n\n`,
          );

          let streamContent = "";

          try {
            // Scale max tokens by desired response length (1-10)
            const lengthScale =
              typeof filters?.responseLength === "number"
                ? filters.responseLength
                : 6;
            const envMax = Number(process.env.OPENAI_MAX_TOKENS ?? 800);
            const maxTokens = Math.min(envMax, 200 + lengthScale * 100);

            const result = await generateTafsirStream(
              { promptOptions, maxTokens },
              (chunk) => {
                // For short responses, buffer chunks and emit at the end to avoid mid-sentence cutoffs
                if (lengthScale <= 3) {
                  streamContent += chunk;
                } else {
                  streamContent += chunk;
                  res.write(
                    `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`,
                  );
                }
              },
            );

            aiResponse = finalizeResponse(
              result.content,
              lengthScale,
              filters?.language,
            );

            if (lengthScale <= 3) {
              // Emit finalized short content now
              res.write(
                `data: ${JSON.stringify({ type: "chunk", content: aiResponse })}\n\n`,
              );
            }

            // Calculate similarity to existing tafsirs
            const mostSimilar = await findMostSimilarTafsir(
              aiResponse,
              similarTafsirs.map((t: any) => ({
                tafsirId: t.tafsirId,
                tafsirText: t.tafsirText,
                scholarName: t.scholarName,
              })),
            );
            const confidence = computeConfidenceScore({
              similarityScores: [mostSimilar?.similarityScore || 0],
              citationCount: citations.length,
              excerptCount: sourceExcerpts.length,
              sourceVerseMatch,
            });

            const saveTafsirId =
              mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
            if (saveTafsirId) {
              await prisma.searchResult.create({
                data: {
                  searchId: search.id,
                  tafsirId: saveTafsirId,
                  aiResponse: aiResponse,
                  citations: citations as unknown as Prisma.InputJsonValue,
                  confidenceScore: confidence,
                  similarityScore: mostSimilar?.similarityScore || null,
                },
              });
            }

            // Send completion event
            res.write(
              `data: ${JSON.stringify({
                type: "complete",
                searchId: search.id,
                runId: search.id,
                usage: result.usage,
                confidence,
                provenance,
                citations,
                sourceExcerpts,
              })}\n\n`,
            );
          } catch (streamError) {
            // Handle streaming errors
            res.write(
              `data: ${JSON.stringify({
                type: "error",
                error:
                  streamError instanceof Error
                    ? streamError.message
                    : "Streaming failed",
              })}\n\n`,
            );
          }

          res.end();
        } else {
          // Non-streaming response
          const lengthScale =
            typeof filters?.responseLength === "number"
              ? filters.responseLength
              : 6;
          const envMax = Number(process.env.OPENAI_MAX_TOKENS ?? 800);
          const maxTokens = Math.min(envMax, 200 + lengthScale * 100);
          const result = await generateTafsirNonStreaming({
            promptOptions,
            maxTokens,
          });
          const requestedLang = filters?.language || "Turkish";
          const translationLabel =
            requestedLang === "Turkish" ? "Meal" : "Meaning";
          const tafsirHeader =
            requestedLang === "Turkish" ? "Tefsir" : "Tafsir";
          const preface =
            `Arabic: ${verse.arabicText}\n` +
            (verse.translation
              ? `${translationLabel}: ${verse.translation}\n\n${tafsirHeader}:\n`
              : `\n${tafsirHeader}:\n`);
          const finalized = finalizeResponse(
            result.content,
            lengthScale,
            filters?.language,
          );
          aiResponse = preface + finalized;

          // Calculate similarity to existing tafsirs
          const mostSimilar = await findMostSimilarTafsir(
            finalized,
            similarTafsirs.map((t: any) => ({
              tafsirId: t.tafsirId,
              tafsirText: t.tafsirText,
              scholarName: t.scholarName,
            })),
          );
          const confidence = computeConfidenceScore({
            similarityScores: [mostSimilar?.similarityScore || 0],
            citationCount: citations.length,
            excerptCount: sourceExcerpts.length,
            sourceVerseMatch,
          });

          const saveTafsirId =
            mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
          if (saveTafsirId) {
            await prisma.searchResult.create({
              data: {
                searchId: search.id,
                tafsirId: saveTafsirId,
                aiResponse: finalized,
                citations: citations as unknown as Prisma.InputJsonValue,
                confidenceScore: confidence,
                similarityScore: mostSimilar?.similarityScore || null,
              },
            });
          }

          res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: verse.surahName,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation,
            },
            filters,
            aiResponse: aiResponse,
            similarityScore: mostSimilar?.similarityScore || null,
            confidence,
            provenance,
            citations,
            sourceExcerpts,
            mostSimilarScholar: mostSimilar?.scholarName || null,
            searchId: search.id,
            runId: search.id,
            usage: result.usage,
          });
        }
      } catch (openaiError) {
        console.error("OpenAI error:", openaiError);

        // Provide a more informative fallback response
        const fallbackResponse = `**Fallback Response** (OpenAI API not available)

**Verse Analysis:** ${verse.surahName} ${verse.verseNumber}
**Arabic:** ${verse.arabicText}
**Translation:** ${verse.translation || "Not available"}

**Available Scholar Excerpts:**
${similarTafsirs
  .map(
    (result: any, index: number) =>
      `${index + 1}. **${result.scholar.name}** (${result.scholar.century}th century, ${result.scholar.madhab || "Unknown"} school):
  ${result.tafsirText.substring(0, 200)}...`,
  )
  .join("\n\n")}

**Requested Parameters:**
- Tone: ${filters?.tone || "Not specified"}/10 (1=emotional, 10=rational)
- Intellect Level: ${filters?.intellectLevel || "Not specified"}/10
- Language: ${filters?.language || "Not specified"}
- Response Length: ${filters?.responseLength || "Not specified"}/10

*This is a fallback response. In production, this would be an AI-generated tafsir based on the provided scholar excerpts and your specified parameters.*`;

        aiResponse = fallbackResponse;
        const confidence = computeConfidenceScore({
          similarityScores: [similarTafsirs[0]?.similarityScore || 0],
          citationCount: citations.length,
          excerptCount: sourceExcerpts.length,
          fallback: true,
          sourceVerseMatch,
        });

        const saveTafsirId = similarTafsirs[0]?.tafsirId;
        if (saveTafsirId) {
          await prisma.searchResult.create({
            data: {
              searchId: search.id,
              tafsirId: saveTafsirId,
              aiResponse: fallbackResponse,
              citations: citations as unknown as Prisma.InputJsonValue,
              confidenceScore: confidence,
              similarityScore: similarTafsirs[0]?.similarityScore || null,
            },
          });
        }

        if (stream) {
          res.write(
            `data: ${JSON.stringify({ type: "chunk", content: fallbackResponse })}\n\n`,
          );
          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              searchId: search.id,
              runId: search.id,
              confidence,
              provenance,
              citations,
              sourceExcerpts,
            })}\n\n`,
          );
          res.end();
        } else {
          res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: verse.surahName,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation,
            },
            filters,
            aiResponse: fallbackResponse,
            similarityScore: similarTafsirs[0]?.similarityScore || null,
            confidence,
            provenance,
            citations,
            sourceExcerpts,
            searchId: search.id,
            runId: search.id,
            usage: null,
            fallback: true,
          });
        }
      }
    } catch (error) {
      console.error("Tafseer error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
