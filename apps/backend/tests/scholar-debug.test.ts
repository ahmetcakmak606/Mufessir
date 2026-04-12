import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import healthRouter from "../src/routes/health.js";
import authRouter from "../src/routes/auth.js";
import filtersRouter from "../src/routes/filters.js";
import versesRouter from "../src/routes/verses.js";
import tafseerRouter from "../src/routes/tafseer.js";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret";
}

const app = express();
app.use(express.json());
const prisma = new PrismaClient();
(app as any).locals.prisma = prisma;

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/filters", filtersRouter);
app.use("/verses", versesRouter);
app.use("/tafseer", tafseerRouter);

describe("Scholar Filter Fallback Fix", () => {
  let token = "";

  beforeAll(async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: "pass1234" });
    token = login.body.token;
  });

  it("fix: should return results even when selected scholars have no tafsir for verse", async () => {
    const verseRes = await request(app)
      .get("/verses")
      .query({ surahNumber: 1, verseNumber: 1 });
    const verseId = verseRes.body.id;

    const filtersRes = await request(app).get("/filters");
    const allScholarIds = filtersRes.body.scholars.map((s: any) => s.id);

    // Get tafsirs for verse
    const existingTafsirs = await prisma.tafsir.findMany({
      where: { verseId },
      select: { scholarId: true },
    });
    const existingScholarIds = [
      ...new Set(existingTafsirs.map((t) => t.scholarId)),
    ];

    // Find scholars that DON'T have tafsir for this verse
    const missingScholarIds = allScholarIds.filter(
      (id: string) => !existingScholarIds.includes(id),
    );

    console.log(
      `\n[Fix Test] Testing with scholars that have NO tafsir: ${missingScholarIds.slice(0, 5).join(", ")}`,
    );

    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseId,
        filters: {
          scholars: missingScholarIds.slice(0, 5),
          language: "Turkish",
        },
        stream: false,
      });

    console.log(`[Fix Test] Status: ${res.status}`);
    console.log(`[Fix Test] Excerpts: ${res.body.sourceExcerpts?.length || 0}`);
    console.log(`[Fix Test] Error: ${res.body.error || "none"}`);

    // BEFORE FIX: This would return 404
    // AFTER FIX: Should return 200 with fallback results
    expect(res.status).toBe(200);
    expect(res.body.sourceExcerpts?.length).toBeGreaterThan(0);
  });

  it("fix: should still respect scholar filter when they have tafsir", async () => {
    const verseRes = await request(app)
      .get("/verses")
      .query({ surahNumber: 1, verseNumber: 1 });
    const verseId = verseRes.body.id;

    // Get scholars WITH tafsir for this verse
    const existingTafsirs = await prisma.tafsir.findMany({
      where: { verseId },
      select: { scholarId: true },
    });
    const existingScholarIds = [
      ...new Set(existingTafsirs.map((t) => t.scholarId)),
    ];

    // Test with scholars that DO have tafsir
    const testIds = existingScholarIds.slice(0, 5);

    console.log(
      `\n[Fix Test] Testing with scholars that HAVE tafsir: ${testIds.join(", ")}`,
    );

    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseId,
        filters: {
          scholars: testIds,
          language: "Turkish",
        },
        stream: false,
      });

    console.log(`[Fix Test] Status: ${res.status}`);
    console.log(`[Fix Test] Excerpts: ${res.body.sourceExcerpts?.length || 0}`);

    expect(res.status).toBe(200);
    expect(res.body.sourceExcerpts?.length).toBeGreaterThan(0);
  });
});
