import { Router } from "express";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
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
import { translateToTurkish } from "../utils/translation.js";
import { prisma } from "../prisma.js";

const router: Router = Router();

const CURRENT_VERSION = "1.2";
const EMBEDDING_MODEL = "text-embedding-3-small";
const LLM_MODEL = "gpt-4o";

function generateSnapshotId(): string {
  const dateStr = new Date().toISOString().split("T")[0] ?? "19700101";
  const date = dateStr.replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `MU-${date}-${randomPart}`;
}

function generateCitationKey(snapshotId: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `MufessirAI, v${CURRENT_VERSION}, ${today}, #${snapshotId.slice(-5)}`;
}

function computePromptHash(promptOptions: any): string {
  if (!promptOptions) return "empty-prompt";
  const normalized = JSON.stringify(
    promptOptions,
    Object.keys(promptOptions ?? {}).sort(),
  );
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

async function createAcademicSnapshot(params: {
  verseId: string;
  searchQuery: string;
  promptOptions: any;
  aiResponse: string;
  arabicTafsir?: string;
  turkishTafsir?: string;
  similarTafsirs: any[];
  confidence: number;
  provenance: string;
  citations: any[];
  searchId: string;
}): Promise<any | null> {
  try {
    const snapshotId = generateSnapshotId();
    const promptHash = computePromptHash(params.promptOptions);
    const citationKey = generateCitationKey(snapshotId);

    const retrievedSources = params.similarTafsirs.map((t: any) => ({
      tafsirId: t.tafsirId,
      scholarName: t.scholarName,
      scholarId: t.mufassir?.id,
      similarityScore: t.similarityScore,
      verseId: t.verseId,
    }));

    return await prisma.academicSnapshot.create({
      data: {
        snapshotId,
        verseId: params.verseId,
        queryText: params.searchQuery,
        corpusVersion: "1.0",
        embeddingModel: EMBEDDING_MODEL,
        llmModel: LLM_MODEL,
        promptHash,
        aiResponse: params.aiResponse,
        arabicTafsir: params.arabicTafsir,
        turkishTafsir: params.turkishTafsir,
        retrievedSources,
        confidence: params.confidence,
        provenance: params.provenance,
        citations: params.citations as any,
        citationKey,
        searchId: params.searchId,
      },
    });
  } catch (snapshotError) {
    console.error("Failed to create academic snapshot:", snapshotError);
    return null;
  }
}

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
  queryValue: any | null,
): Record<string, unknown> {
  const queryObj = asRecord(queryValue);
  return asRecord(queryObj.filters);
}

function extractRunMeta(queryValue: any | null): RunMeta {
  const queryObj = asRecord(queryValue);
  const meta = asRecord(queryObj.runMeta);
  return {
    title: typeof meta.title === "string" ? meta.title : null,
    notes: typeof meta.notes === "string" ? meta.notes : null,
    starred: typeof meta.starred === "boolean" ? meta.starred : false,
    updatedAt: typeof meta.updatedAt === "string" ? meta.updatedAt : null,
  };
}

function parseStoredCitations(value: any | null): Citation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter(
      (row) =>
        typeof row.mufassirId === "string" &&
        typeof row.scholarName === "string",
    )
    .map((row) => ({
      scholarId: String(row.mufassirId),
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
  const runMeta = extractRunMeta(search.query as any | null);
  const updatedAt = runMeta.updatedAt || latest?.createdAt || search.createdAt;
  return {
    runId: search.id,
    searchId: search.id,
    verse: {
      id: search.verseId.id,
      surahNumber: search.verseId.surahNumber,
      surahName: search.verseId.surahName,
      verseNumber: search.verseId.verseNumber,
    },
    filters: extractFiltersFromQuery(search.query as any | null),
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
        results: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!search) {
      return res.status(404).json({ error: "Run not found" });
    }

    const latest = search.results[0];
    const citations = parseStoredCitations(
      (latest?.citations ?? null) as any | null,
    );
    const runMeta = extractRunMeta(search.query as any | null);
    const updatedAt =
      runMeta.updatedAt || latest?.createdAt || search.createdAt;
    const sourceExcerpts: SourceExcerpt[] = [];

    return res.json({
      runId: search.id,
      searchId: search.id,
      verse: search.verseId,
      filters: extractFiltersFromQuery(search.query as any | null),
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

    const currentQuery = asRecord(search.query as any | null);
    const currentMeta = extractRunMeta(search.query as any | null);
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

    const updatedQuery: any = {
      ...currentQuery,
      runMeta: nextMeta,
    };

    const updated = await prisma.search.update({
      where: { id: runId },
      data: { query: updatedQuery },
      include: {
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
  return similarTafsirs.slice(0, 5).map((result: any) => ({
    scholarId: result.mufassir.id,
    scholarName: result.mufassir.name,
    excerpt:
      result.tafsirText.length > 500
        ? `${result.tafsirText.slice(0, 500)}...`
        : result.tafsirText,
  }));
}

function extractReputationScores(similarTafsirs: any[]): number[] {
  return similarTafsirs
    .map((t: any) => t.mufassir?.reputationScore || 5)
    .filter((score: number) => typeof score === "number");
}

interface ScholarGroupAnalysis {
  dominantMadhab: string | null;
  dominantPeriod: string | null;
  madhabCounts: Record<string, number>;
  periodCounts: Record<string, number>;
  totalScholars: number;
  hasMultipleMadhhabs: boolean;
  scholarContext: string;
}

function analyzeScholarGroup(similarTafsirs: any[]): ScholarGroupAnalysis {
  const madhabCounts: Record<string, number> = {};
  const periodCounts: Record<string, number> = {};
  const traditions: Set<string> = new Set();

  for (const t of similarTafsirs) {
    const madhab = t.mufassir?.madhab;
    const period = t.mufassir?.period;
    const tradition = t.mufassir?.traditionAcceptance;

    if (madhab) {
      madhabCounts[madhab] = (madhabCounts[madhab] || 0) + 1;
    }
    if (period) {
      periodCounts[period] = (periodCounts[period] || 0) + 1;
    }
    if (Array.isArray(tradition)) {
      tradition.forEach((tr: string) => traditions.add(tr));
    }
  }

  // Find dominant madhab
  let dominantMadhab: string | null = null;
  let maxMadhabCount = 0;
  for (const [madhab, count] of Object.entries(madhabCounts)) {
    if (count > maxMadhabCount) {
      maxMadhabCount = count;
      dominantMadhab = madhab;
    }
  }

  // Find dominant period
  let dominantPeriod: string | null = null;
  let maxPeriodCount = 0;
  for (const [period, count] of Object.entries(periodCounts)) {
    if (count > maxPeriodCount) {
      maxPeriodCount = count;
      dominantPeriod = period;
    }
  }

  const totalScholars = similarTafsirs.length;
  const hasMultipleMadhhabs = Object.keys(madhabCounts).length > 1;

  // Build contextual framing string
  let scholarContext = "";
  if (totalScholars > 5) {
    if (dominantMadhab && maxMadhabCount >= Math.ceil(totalScholars * 0.5)) {
      scholarContext = `Bu tefsir ${dominantMadhab} alimlerinin genel görüşlerini yansıtmaktadır.`;
    } else if (dominantPeriod) {
      scholarContext = `Bu tefsir ${dominantPeriod} dönemindeki alimlerin yorumlarını içermektedir.`;
    } else if (hasMultipleMadhhabs) {
      scholarContext = `Bu tefsir farklı İslami mezheplerden alimlerin yorumlarını birleştirmektedir.`;
    } else {
      scholarContext = `Bu tefsir ${totalScholars} farklı alimin yorumundan derlenmiştir.`;
    }
  } else if (totalScholars > 1) {
    scholarContext = `Bu tefsir ${totalScholars} alimin yorumlarına dayanmaktadır.`;
  }

  return {
    dominantMadhab,
    dominantPeriod,
    madhabCounts,
    periodCounts,
    totalScholars,
    hasMultipleMadhhabs,
    scholarContext,
  };
}

async function loadCitations(
  _prismaClient: PrismaClient,
  similarTafsirs: any[],
): Promise<Citation[]> {
  const scholarIds = [
    ...new Set(similarTafsirs.map((result: any) => result.mufassir.id)),
  ];
  if (!scholarIds.length) return [];

  return scholarIds.map((id: string) => ({
    scholarId: id,
    scholarName:
      similarTafsirs.find((t: any) => t.mufassir.id === id)?.mufassir.name ||
      "",
    sourceType: "Tafsir",
    sourceTitle: "",
    volume: null,
    page: null,
    edition: null,
    citationText: null,
    provenance: null,
    isPrimary: false,
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
          mufassirs?: string[];
          excludeMufassirs?: string[];
          methodTags?: string[];
          language?: string;
          responseLength?: number;
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
      let similarTafsirs: any[] = [];
      let usedScholarFilter = false;

      // Check if user specified scholar filters
      const hasScholarFilter =
        (filters?.mufassirs && filters.mufassirs.length > 0) ||
        (filters?.excludeScholars && filters.excludeScholars.length > 0);

      try {
        similarTafsirs = await performSimilaritySearch(prisma, {
          query: searchQuery,
          verseId: verseId,
          scholarIds: filters?.mufassirs,
          excludeScholarIds: filters?.excludeScholars,
          methodTags: filters?.methodTags,
          limit: 5,
          minSimilarity: 0.3,
        });
        usedScholarFilter = hasScholarFilter === true;
      } catch (searchError) {
        console.error("Similarity search error:", searchError);
      }

      // If scholar filter was used but returned no results, return info message
      // instead of showing results from unselected scholars
      if (similarTafsirs.length === 0 && hasScholarFilter) {
        const requestedScholarIds = filters?.mufassirs || [];

        // Find which of the requested scholars have tafsir for this verse
        const existingTafsirs = await prisma.tafsir.findMany({
          where: {
            verseId,
            mufassirId: { in: requestedScholarIds.map(Number) },
          },
          select: { mufassirId: true },
        });

        const scholarsWithTafsir = [
          ...new Set(existingTafsirs.map((t: any) => t.mufassirId)),
        ];
        const scholarsWithoutTafsir = requestedScholarIds.filter(
          (id: string) => !scholarsWithTafsir.includes(Number(id)),
        );

        // Get scholar names for the response
        const allScholars = await prisma.mufassir.findMany({
          where: { id: { in: scholarsWithoutTafsir.map(Number) } },
          select: { id: true, nameEn: true, nameTr: true },
        });

        const missingNames = allScholars
          .map((s: any) => s.nameTr || s.nameEn)
          .join(", ");

        return res.status(200).json({
          verse,
          filters: filters || {},
          aiResponse: "",
          arabicTafsir: null,
          turkishTafsir: null,
          confidence: null,
          provenance: null,
          citations: [],
          sourceExcerpts: [],
          runId: null,
          searchId: null,
          noTafsirForSelectedScholars: true,
          noTafsirMessage: `Seçilen alimlerin bu ayet için tefsiri bulunmamaktadır. Şu alimlerin tefsiri yok: ${missingNames}`,
          missingScholarNames: allScholars.map(
            (s: any) => s.nameTr || s.nameEn,
          ),
        });
      }

      // For streaming: send noTafsir message to client
      // This is handled in the stream response below - check if similarTafsirs is empty

      // Final fallback: get any tafsirs for this verse (no similarity search)
      if (similarTafsirs.length === 0) {
        const sampleTafsirs = await prisma.tafsir.findMany({
          where: { verseId },
          select: {
            id: true,
            verseId: true,
            tafsirText: true,
            mufassir: {
              select: {
                id: true,
                nameEn: true,
                nameTr: true,
                nameAr: true,
                century: true,
                madhab: true,
                period: true,
                environment: true,
                originCountry: true,
                reputationScore: true,
              },
            },
            verse: {
              select: {
                surahNumber: true,
                verseNumber: true,
              },
            },
          },
          take: 3,
        });

        similarTafsirs = sampleTafsirs.map((tafsir: any) => ({
          tafsirId: tafsir.id,
          scholarName:
            tafsir.mufassir.nameEn ||
            tafsir.mufassir.nameTr ||
            tafsir.mufassir.nameAr ||
            "Unknown",
          tafsirText: tafsir.tafsirText,
          similarityScore: 0.7, // Mock similarity score
          verseId: tafsir.verseId,
          surahNumber: tafsir.verse.surahNumber,
          verseNumber: tafsir.verse.verseNumber,
          scholar: {
            id: tafsir.mufassir.id,
            name:
              tafsir.mufassir.nameEn ||
              tafsir.mufassir.nameTr ||
              tafsir.mufassir.nameAr ||
              "Unknown",
            century: tafsir.mufassir.century,
            madhab: tafsir.mufassir.madhab,
            period: tafsir.mufassir.period,
            environment: tafsir.mufassir.environment,
            originCountry: tafsir.mufassir.originCountry,
            reputationScore: tafsir.mufassir.reputationScore,
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

      // Check if we have any sources to generate tafsir from
      if (similarTafsirs.length === 0) {
        // No tafsir data at all for this verse
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

          res.write(`data: ${JSON.stringify({ type: "start" })}\n\n`);
          res.write(
            `data: ${JSON.stringify({
              type: "complete",
              noTafsirForSelectedScholars: true,
              noTafsirMessage:
                "Bu ayet için hiç tefsir verisi bulunmamaktadır.",
              missingScholarNames: [],
            })}\n\n`,
          );
          res.end();
        } else {
          return res.status(200).json({
            verse,
            filters: filters || {},
            aiResponse: "",
            confidence: null,
            provenance: null,
            citations: [],
            sourceExcerpts: [],
            noTafsirForSelectedScholars: true,
            noTafsirMessage: "Bu ayet için hiç tefsir verisi bulunmamaktadır.",
          });
        }
        return;
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

      // Analyze scholars for patterns (madhab, period, tradition)
      const scholarAnalysis = analyzeScholarGroup(similarTafsirs);

      const promptOptions = {
        verseText: verse.arabicText,
        translation: verse.translation || undefined,
        tafsirExcerpts: similarTafsirs.slice(0, 5).map((result: any) => ({
          scholar: {
            name: result.mufassir.name,
            century: result.mufassir.century,
            madhab: result.mufassir.madhab || undefined,
            period: result.mufassir.period || undefined,
            environment: result.mufassir.environment || undefined,
            originCountry: result.mufassir.originCountry || undefined,
            reputationScore: result.mufassir.reputationScore || undefined,
          } as ScholarMeta,
          excerpt:
            result.tafsirText.length > 500
              ? result.tafsirText.substring(0, 500) + "..."
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
          methodTags: filters?.methodTags,
          language: filters?.language || "Turkish",
        },
        scholarAnalysis,
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
              surahName: "Surah",
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
            scholarReputationScores: extractReputationScores(similarTafsirs),
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
                surahName: "Surah",
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

            // AI generates in Arabic
            const arabicTafsir = finalizeResponse(
              result.content,
              lengthScale,
              "Arabic",
            );

            // Translate to Turkish
            let turkishTafsir = "";
            try {
              const translation = await translateToTurkish(arabicTafsir);
              turkishTafsir = translation.translatedText;
            } catch (translateErr) {
              console.error("Translation error:", translateErr);
              turkishTafsir = arabicTafsir;
            }

            // Send Turkish translation to user (if requested)
            const requestedLang = filters?.language || "Turkish";
            const displayTafsir =
              requestedLang === "Turkish" ? turkishTafsir : arabicTafsir;

            aiResponse = finalizeResponse(
              displayTafsir,
              lengthScale,
              requestedLang,
            );

            if (lengthScale <= 3) {
              // Emit finalized short content now
              res.write(
                `data: ${JSON.stringify({ type: "chunk", content: aiResponse })}\n\n`,
              );
            }

            // Calculate similarity to existing tafsirs (use Arabic for matching)
            const mostSimilar = await findMostSimilarTafsir(
              arabicTafsir,
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
              scholarReputationScores: extractReputationScores(similarTafsirs),
            });

            const saveTafsirId =
              mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
            if (saveTafsirId) {
              await prisma.searchResult.create({
                data: {
                  searchId: search.id,
                  tafsirId: saveTafsirId,
                  aiResponse: arabicTafsir,
                  citations: citations as unknown as any,
                  confidenceScore: confidence,
                  similarityScore: mostSimilar?.similarityScore || null,
                },
              });

              await createAcademicSnapshot({
                verseId,
                searchQuery,
                promptOptions,
                aiResponse: arabicTafsir,
                arabicTafsir,
                turkishTafsir,
                similarTafsirs,
                confidence,
                provenance,
                citations,
                searchId: search.id,
              }).then((snapshot) => {
                if (snapshot) {
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
                      arabicTafsir,
                      turkishTafsir,
                      citationKey: snapshot.citationKey,
                    })}\n\n`,
                  );
                } else {
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
                      arabicTafsir,
                      turkishTafsir,
                    })}\n\n`,
                  );
                }
              });
            }
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

          // The AI now generates in Arabic
          const arabicTafsir = finalizeResponse(
            result.content,
            lengthScale,
            "Arabic",
          );

          // Translate Arabic to Turkish
          let turkishTafsir = "";
          try {
            const translation = await translateToTurkish(arabicTafsir);
            turkishTafsir = translation.translatedText;
          } catch (translateErr) {
            console.error("Translation error:", translateErr);
            // If translation fails, use Arabic as fallback
            turkishTafsir = arabicTafsir;
          }

          // Build response based on requested language
          const requestedLang = filters?.language || "Turkish";
          const translationLabel =
            requestedLang === "Turkish" ? "Meal" : "Meaning";
          const tafsirHeader =
            requestedLang === "Turkish" ? "Tefsir" : "Tafsir";

          // Use Turkish if requested, otherwise Arabic
          const displayTafsir =
            requestedLang === "Turkish" ? turkishTafsir : arabicTafsir;
          const preface =
            `Arabic: ${verse.arabicText}\n` +
            (verse.translation
              ? `${translationLabel}: ${verse.translation}\n\n${tafsirHeader}:\n`
              : `\n${tafsirHeader}:\n`);
          aiResponse = preface + displayTafsir;

          // Calculate similarity to existing tafsirs
          const mostSimilar = await findMostSimilarTafsir(
            arabicTafsir,
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
            scholarReputationScores: extractReputationScores(similarTafsirs),
          });

          let citationKey: string | null = null;
          const saveTafsirId =
            mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
          if (saveTafsirId) {
            await prisma.searchResult.create({
              data: {
                searchId: search.id,
                tafsirId: saveTafsirId,
                aiResponse: arabicTafsir,
                citations: citations as unknown as any,
                confidenceScore: confidence,
                similarityScore: mostSimilar?.similarityScore || null,
              },
            });

            const snapshot = await createAcademicSnapshot({
              verseId,
              searchQuery,
              promptOptions,
              aiResponse: displayTafsir,
              arabicTafsir,
              turkishTafsir,
              similarTafsirs,
              confidence,
              provenance,
              citations,
              searchId: search.id,
            });
            if (snapshot) {
              citationKey = snapshot.citationKey;
            }
          }

          res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: "Surah",
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation,
            },
            filters,
            aiResponse: aiResponse,
            arabicTafsir,
            turkishTafsir,
            similarityScore: mostSimilar?.similarityScore || null,
            confidence,
            provenance,
            citations,
            sourceExcerpts,
            mostSimilarScholar: mostSimilar?.scholarName || null,
            searchId: search.id,
            runId: search.id,
            usage: result.usage,
            citationKey,
          });
        }
      } catch (openaiError) {
        console.error("OpenAI error:", openaiError);

        // Provide a more informative fallback response
        const fallbackResponse = `**Fallback Response** (OpenAI API not available)

**Verse Analysis:** ${"Surah"} ${verse.verseNumber}
**Arabic:** ${verse.arabicText}
**Translation:** ${verse.translation || "Not available"}

**Available Scholar Excerpts:**
${similarTafsirs
  .map(
    (result: any, index: number) =>
      `${index + 1}. **${result.mufassir.name}** (${result.mufassir.century}th century, ${result.mufassir.madhab || "Unknown"} school):
  ${result.tafsirText.substring(0, 200)}...`,
  )
  .join("\n\n")}

**Requested Parameters:**
- Methodology Tags: ${filters?.methodTags?.join(", ") || "Not specified"}
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
          scholarReputationScores: extractReputationScores(similarTafsirs),
        });

        const saveTafsirId = similarTafsirs[0]?.tafsirId;
        if (saveTafsirId) {
          await prisma.searchResult.create({
            data: {
              searchId: search.id,
              tafsirId: saveTafsirId,
              aiResponse: fallbackResponse,
              citations: citations as unknown as any,
              confidenceScore: confidence,
              similarityScore: similarTafsirs[0]?.similarityScore || null,
            },
          });

          await createAcademicSnapshot({
            verseId,
            searchQuery,
            promptOptions,
            aiResponse: fallbackResponse,
            similarTafsirs,
            confidence,
            provenance,
            citations,
            searchId: search.id,
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
              surahName: "Surah",
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

router.get("/snapshots/:snapshotId", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const snapshotId = req.params.snapshotId;

    if (!snapshotId) {
      return res.status(400).json({ error: "snapshotId is required" });
    }

    const snapshot = await prisma.academicSnapshot.findUnique({
      where: {
        snapshotId,
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    if (!snapshot.searchId) {
      return res.json({
        snapshotId: snapshot.snapshotId,
        citationKey: snapshot.citationKey,
        verse: null,
        queryText: snapshot.queryText,
        aiResponse: snapshot.aiResponse,
        arabicTafsir: snapshot.arabicTafsir,
        turkishTafsir: snapshot.turkishTafsir,
        retrievedSources: snapshot.retrievedSources,
        confidence: snapshot.confidence,
        provenance: snapshot.provenance,
        citations: snapshot.citations,
        generatedAt: snapshot.generatedAt,
        systemInfo: {
          corpusVersion: snapshot.corpusVersion,
          embeddingModel: snapshot.embeddingModel,
          llmModel: snapshot.llmModel,
          promptHash: snapshot.promptHash,
        },
      });
    }

    const search = await prisma.search.findFirst({
      where: {
        id: snapshot.searchId,
        userId,
      },
      include: {},
    });

    if (!search) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    return res.json({
      snapshotId: snapshot.snapshotId,
      citationKey: snapshot.citationKey,
      verse: search.verseId,
      queryText: snapshot.queryText,
      aiResponse: snapshot.aiResponse,
      arabicTafsir: snapshot.arabicTafsir,
      turkishTafsir: snapshot.turkishTafsir,
      retrievedSources: snapshot.retrievedSources,
      confidence: snapshot.confidence,
      provenance: snapshot.provenance,
      citations: snapshot.citations,
      generatedAt: snapshot.generatedAt,
      systemInfo: {
        corpusVersion: snapshot.corpusVersion,
        embeddingModel: snapshot.embeddingModel,
        llmModel: snapshot.llmModel,
        promptHash: snapshot.promptHash,
      },
    });
  } catch (error) {
    console.error("Snapshot retrieval error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
