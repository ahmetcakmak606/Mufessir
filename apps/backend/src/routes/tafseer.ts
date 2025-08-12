import { Router } from "express";
import { authenticateJWT, enforceQuota, decrementQuota } from "../middleware/auth.js";
import { PrismaClient } from "@prisma/client";
import { generateTafsirStream, generateTafsirNonStreaming } from "../utils/openai.js";
import { buildTafsirPrompt, type ScholarMeta } from "../utils/prompt.js";
import { performSimilaritySearch } from "../utils/similarity-search.js";
import { findMostSimilarTafsir } from "../utils/similarity-calculation.js";

const router: Router = Router();

const prisma: PrismaClient = (global as any).prisma || new PrismaClient();
if (!(global as any).prisma) (global as any).prisma = prisma;

// Protected endpoint that requires auth and enforces quota
router.post("/", 
  authenticateJWT, 
  enforceQuota(prisma), 
  decrementQuota(prisma),
  async (req, res) => {
    try {
      const { verseId, filters, stream = false } = req.body as {
        verseId: string;
        filters?: {
          scholars?: string[];
          excludeScholars?: string[];
          tone?: number; // 1-10 emotional vs rational
          intellectLevel?: number; // 1-10 vocabulary richness
          language?: string;
          compareWith?: string; // scholar name to compare with
        };
        stream?: boolean;
      };

      if (!verseId) {
        return res.status(400).json({ error: "Verse ID is required" });
      }

      // Get verse details
      const verse = await prisma.verse.findUnique({
        where: { id: verseId }
      });

      if (!verse) {
        return res.status(404).json({ error: "Verse not found" });
      }

      // Perform vector similarity search to find relevant tafsirs
      let similarTafsirs = [];
      try {
        const searchQuery = `${verse.arabicText} ${verse.translation || ""}`.trim();
        similarTafsirs = await performSimilaritySearch(prisma, {
          query: searchQuery,
          verseId: filters?.scholars || filters?.excludeScholars ? undefined : verseId, // Only filter by verse if no scholar filtering
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

      // Build prompt options
      const promptOptions = {
        verseText: verse.arabicText,
        translation: verse.translation || undefined,
        tafsirExcerpts: similarTafsirs.map((result: any) => ({
          scholar: {
            name: result.scholar.name,
            century: result.scholar.century,
            madhab: result.scholar.madhab || undefined,
            period: result.scholar.period || undefined,
            environment: result.scholar.environment || undefined,
            originCountry: result.scholar.originCountry || undefined,
            reputationScore: result.scholar.reputationScore || undefined,
          } as ScholarMeta,
          excerpt: result.tafsirText.length > 500 
            ? result.tafsirText.substring(0, 500) + "..." 
            : result.tafsirText,
        })),
        userParams: {
          tone: filters?.tone,
          intellectLevel: filters?.intellectLevel,
          language: filters?.language || 'Turkish',
          compareWith: filters?.compareWith,
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
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // If we have a recent cached result (within 1 hour), return it
      if (existingSearch?.results[0] && 
          new Date().getTime() - existingSearch.createdAt.getTime() < 60 * 60 * 1000) {
        
        const cachedResult = existingSearch.results[0];
        console.log("Returning cached result for search:", existingSearch.id);
        
        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
          
          res.write(`data: ${JSON.stringify({ type: 'start', searchId: existingSearch.id, cached: true })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: cachedResult.aiResponse })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'complete', searchId: existingSearch.id, cached: true })}\n\n`);
          res.end();
        } else {
          return res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: verse.surahName,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation
            },
            filters,
            aiResponse: cachedResult.aiResponse,
            similarityScore: cachedResult.similarityScore,
            searchId: existingSearch.id,
            usage: null,
            cached: true,
          });
        }
        return;
      }

      // Create new search record
      const search = await prisma.search.create({
        data: {
          userId: (req as any).user!.id,
          verseId,
          query: { filters, verseId, cacheKey, timestamp: new Date().toISOString() },
        },
      });

      let aiResponse = "";
      let similarityScore = null;

      try {
        if (stream) {
          // Stream the response using Server-Sent Events
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

          // Send initial data
          res.write(`data: ${JSON.stringify({ type: 'start', searchId: search.id })}\n\n`);

          // Send verse preface first: Arabic, then translation in requested language (if available)
          const requestedLang = filters?.language || 'Turkish';
          const label = requestedLang === 'Turkish' ? 'Meal' : 'Meaning';
          const prefaceLines = [`Arabic: ${verse.arabicText}`];
          if (verse.translation) prefaceLines.push(`${label}: ${verse.translation}`);
          prefaceLines.push("\nMeali:");
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: prefaceLines.join("\n") + "\n\n" })}\n\n`);

          let streamContent = "";
          
          try {
            const result = await generateTafsirStream(
              { promptOptions },
              (chunk) => {
                streamContent += chunk;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
              }
            );

            aiResponse = result.content;

            // Calculate similarity to existing tafsirs
            const mostSimilar = await findMostSimilarTafsir(
              result.content,
              similarTafsirs.map((t: any) => ({
                tafsirId: t.tafsirId,
                tafsirText: t.tafsirText,
                scholarName: t.scholarName
              }))
            );

            const saveTafsirId = mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
            if (saveTafsirId) {
              await prisma.searchResult.create({
                data: {
                  searchId: search.id,
                  tafsirId: saveTafsirId,
                  aiResponse: result.content,
                  similarityScore: mostSimilar?.similarityScore || null,
                },
              });
            }

            // Send completion event
            res.write(`data: ${JSON.stringify({ 
              type: 'complete', 
              searchId: search.id,
              usage: result.usage 
            })}\n\n`);
          } catch (streamError) {
            // Handle streaming errors
            res.write(`data: ${JSON.stringify({ 
              type: 'error', 
              error: streamError instanceof Error ? streamError.message : 'Streaming failed' 
            })}\n\n`);
          }

          res.end();
        } else {
          // Non-streaming response
          const result = await generateTafsirNonStreaming({ promptOptions });
          const requestedLang = filters?.language || 'Turkish';
          const label = requestedLang === 'Turkish' ? 'Meal' : 'Meaning';
          const preface = `Arabic: ${verse.arabicText}\n` + (verse.translation ? `${label}: ${verse.translation}\n\nTefsir:\n` : `\nTefsir:\n`);
          aiResponse = preface + result.content;

          // Calculate similarity to existing tafsirs
          const mostSimilar = await findMostSimilarTafsir(
            result.content,
            similarTafsirs.map((t: any) => ({
              tafsirId: t.tafsirId,
              tafsirText: t.tafsirText,
              scholarName: t.scholarName
            }))
          );

          const saveTafsirId = mostSimilar?.tafsirId || similarTafsirs[0]?.tafsirId;
          if (saveTafsirId) {
            await prisma.searchResult.create({
              data: {
                searchId: search.id,
                tafsirId: saveTafsirId,
                aiResponse: result.content,
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
              translation: verse.translation
            },
            filters,
            aiResponse: aiResponse,
            similarityScore: mostSimilar?.similarityScore || null,
            mostSimilarScholar: mostSimilar?.scholarName || null,
            searchId: search.id,
            usage: result.usage,
          });
        }
      } catch (openaiError) {
        console.error("OpenAI error:", openaiError);
        
        // Provide a more informative fallback response
        const fallbackResponse = `**Fallback Response** (OpenAI API not available)

**Verse Analysis:** ${verse.surahName} ${verse.verseNumber}
**Arabic:** ${verse.arabicText}
**Translation:** ${verse.translation || 'Not available'}

**Available Scholar Excerpts:**
${similarTafsirs.map((result: any, index: number) => 
  `${index + 1}. **${result.scholar.name}** (${result.scholar.century}th century, ${result.scholar.madhab || 'Unknown'} school):
  ${result.tafsirText.substring(0, 200)}...`
).join('\n\n')}

**Requested Parameters:**
- Tone: ${filters?.tone || 'Not specified'}/10 (1=emotional, 10=rational)
- Intellect Level: ${filters?.intellectLevel || 'Not specified'}/10
- Language: ${filters?.language || 'Not specified'}
- Compare with: ${filters?.compareWith || 'Not specified'}

*This is a fallback response. In production, this would be an AI-generated tafsir based on the provided scholar excerpts and your specified parameters.*`;

        aiResponse = fallbackResponse;

        const saveTafsirId = similarTafsirs[0]?.tafsirId;
        if (saveTafsirId) {
          await prisma.searchResult.create({
            data: {
              searchId: search.id,
              tafsirId: saveTafsirId,
              aiResponse: fallbackResponse,
              similarityScore: similarTafsirs[0]?.similarityScore || null,
            },
          });
        }

        if (stream) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: fallbackResponse })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'complete', searchId: search.id })}\n\n`);
          res.end();
        } else {
          res.json({
            verse: {
              id: verse.id,
              surahNumber: verse.surahNumber,
              surahName: verse.surahName,
              verseNumber: verse.verseNumber,
              arabicText: verse.arabicText,
              translation: verse.translation
            },
            filters,
            aiResponse: fallbackResponse,
            similarityScore: similarTafsirs[0]?.similarityScore || null,
            searchId: search.id,
            usage: null,
            fallback: true,
          });
        }
      }
    } catch (error) {
      console.error("Tafseer error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router; 