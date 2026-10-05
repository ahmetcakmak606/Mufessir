import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import healthRouter from "../src/routes/health.js";
import authRouter from "../src/routes/auth.js";
import filtersRouter from "../src/routes/filters.js";
import versesRouter from "../src/routes/verses.js";
import tafseerRouter from "../src/routes/tafseer.js";
import { PrismaClient } from "@prisma/client";
import { ensureTestDatabase, dropTestDatabase } from "./helpers/test-db.js";
import { seedMinimalCorpus, SEED_VERSE_ID, SEED_MUFASSIR_ID } from "./helpers/seed.js";
import { buildTafsirCacheKey } from "../src/utils/tafseer-cache.js";
import { InputPolicyError } from "../src/utils/input-policy.js";
import crypto from "node:crypto";

// Tests use passwords that satisfy the 1B.5 policy (>= 10 chars).
const TEST_PASSWORD = "pass12345678";

function mockRandomInt(...values: number[]) {
  const spy = vi.spyOn(crypto, "randomInt");
  for (const value of values) {
    spy.mockImplementationOnce(() => value as never);
  }
  return spy;
}

// Disposable per-run test database. The env guard (tests/setup/env-guard.ts)
// ran before these imports and pointed DATABASE_URL at it; this must be ready
// before any PrismaClient below issues its first query.
await ensureTestDatabase();

// Create an in-process express app using the same routers
const app = express();
app.use(express.json());
const prisma = new PrismaClient();
(app as any).locals.prisma = prisma;

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/filters", filtersRouter);
app.use("/verses", versesRouter);
app.use("/tafseer", tafseerRouter);

// Mirror the production error handler so policy errors surface as 400 here
// too (routers now route failures through next(err) via asyncHandler).
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof InputPolicyError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error("unhandled test-app error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

await seedMinimalCorpus(prisma);

afterAll(async () => {
  await prisma.$disconnect();
  await dropTestDatabase();
});

describe("Health", () => {
  it("GET /health should return ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("Auth", () => {
  let token = "";
  const resetEmail = `resetuser+${Date.now()}@example.com`;
  const resetOriginalPassword = "oldpass1234";
  const resetNewPassword = "newpass1234";

  it("registers a user", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "testuser@example.com",
      password: TEST_PASSWORD,
      name: "Tester",
    });
    expect([200, 201, 409]).toContain(res.status); // 409 if user exists
  });

  it("logs in and returns a token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it("returns 400 for login with missing fields", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "missing@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 401 for /auth/me without token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for /auth/me with invalid token", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  it("returns profile with /auth/me", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("testuser@example.com");
  });

  it("rejects google sso request without id token", async () => {
    const res = await request(app).post("/auth/sso/google").send({});
    expect(res.status).toBe(400);
  });

  it("returns 503 for google sso when provider is not configured", async () => {
    const prevGoogleClientId = process.env.GOOGLE_CLIENT_ID;
    const prevGoogleClientIds = process.env.GOOGLE_CLIENT_IDS;
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_IDS = "";
    try {
      const res = await request(app)
        .post("/auth/sso/google")
        .send({ idToken: "dummy-google-token" });
      expect(res.status).toBe(503);
    } finally {
      if (prevGoogleClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = prevGoogleClientId;
      }
      if (prevGoogleClientIds === undefined) {
        delete process.env.GOOGLE_CLIENT_IDS;
      } else {
        process.env.GOOGLE_CLIENT_IDS = prevGoogleClientIds;
      }
    }
  });

  it("rejects apple sso request without id token", async () => {
    const res = await request(app).post("/auth/sso/apple").send({});
    expect(res.status).toBe(400);
  });

  it("returns 503 for apple sso when provider is not configured", async () => {
    const prevAppleClientId = process.env.APPLE_CLIENT_ID;
    const prevAppleClientIds = process.env.APPLE_CLIENT_IDS;
    process.env.APPLE_CLIENT_ID = "";
    process.env.APPLE_CLIENT_IDS = "";
    try {
      const res = await request(app)
        .post("/auth/sso/apple")
        .send({ idToken: "dummy-apple-token" });
      expect(res.status).toBe(503);
    } finally {
      if (prevAppleClientId === undefined) {
        delete process.env.APPLE_CLIENT_ID;
      } else {
        process.env.APPLE_CLIENT_ID = prevAppleClientId;
      }
      if (prevAppleClientIds === undefined) {
        delete process.env.APPLE_CLIENT_IDS;
      } else {
        process.env.APPLE_CLIENT_IDS = prevAppleClientIds;
      }
    }
  });

  it("registers a dedicated password-reset user", async () => {
    const res = await request(app).post("/auth/register").send({
      email: resetEmail,
      password: resetOriginalPassword,
      name: "Reset User",
    });
    expect([201, 409]).toContain(res.status);
  });

  it("rejects password reset request when email is missing", async () => {
    const res = await request(app)
      .post("/auth/password/reset/request")
      .send({});
    expect(res.status).toBe(400);
  });

  it("accepts password reset request for unknown email (non-enumeration)", async () => {
    const res = await request(app)
      .post("/auth/password/reset/request")
      .send({ email: "unknown-user@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("creates a password reset code for existing user", async () => {
    // 1B.2: kod crypto.randomInt ile üretiliyor; test değeri sabitleniyor.
    const randomSpy = mockRandomInt(100000);
    try {
      const res = await request(app)
        .post("/auth/password/reset/request")
        .send({ email: resetEmail });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("rejects password reset confirmation with missing fields", async () => {
    const res = await request(app)
      .post("/auth/password/reset/confirm")
      .send({ email: resetEmail });
    expect(res.status).toBe(400);
  });

  it("rejects password reset confirmation with wrong code", async () => {
    const res = await request(app).post("/auth/password/reset/confirm").send({
      email: resetEmail,
      code: "999999",
      newPassword: resetNewPassword,
    });
    expect(res.status).toBe(400);
  });

  it("confirms password reset with valid code", async () => {
    const res = await request(app).post("/auth/password/reset/confirm").send({
      email: resetEmail,
      code: "100000",
      newPassword: resetNewPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("logs in with the new password after reset", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: resetEmail, password: resetNewPassword });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });
});

describe("Filters & Verses", () => {
  it("GET /filters returns scholars and options", async () => {
    const res = await request(app).get("/filters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scholars)).toBe(true);
    expect(res.body.filterOptions).toBeDefined();
    // Skip if db was reset and lacks scholars data
    const periodCodes = res.body.filterOptions?.periodCodes;
    if (!Array.isArray(periodCodes) || periodCodes.length === 0) {
      return;
    }
    expect(Array.isArray(periodCodes)).toBe(true);
    expect(Array.isArray(res.body.filterOptions.sourceAccessibilities)).toBe(
      true,
    );
  });

  it("GET /verses composite lookup works", async () => {
    const res = await request(app)
      .get("/verses")
      .query({ surahNumber: 1, verseNumber: 1 });
    expect(res.status).toBe(200);
    // Allow both old and new ID format (for db migrations)
    expect(res.body.id).toMatch(/^(verse-|v\d+-)/);
  });

  it("GET /verses returns 404 for unknown composite key", async () => {
    const res = await request(app)
      .get("/verses")
      .query({ surahNumber: 999, verseNumber: 1 });
    expect(res.status).toBe(404);
  });

  it("GET /verses supports text search", async () => {
    const res = await request(app)
      .get("/verses")
      .query({ q: "Allah", take: 5, skip: 0 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.skip).toBe(0);
    expect(res.body.take).toBe(5);
  });

  it("GET /verses lists verses when no query is provided", async () => {
    const res = await request(app).get("/verses").query({ take: 3, skip: 0 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.skip).toBe(0);
    expect(res.body.take).toBe(3);
  });
});

describe("Tafseer", () => {
  let token = "";
  let runId = "";
  beforeAll(async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: TEST_PASSWORD });
    token = login.body.token;
  });

  it("POST /tafseer returns AI or fallback (non-streaming)", async () => {
    const verseRes = await request(app)
      .get("/verses")
      .query({ surahNumber: 1, verseNumber: 1 });
    const verseId = verseRes.body.id;
    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseId,
        filters: { tone: 7, intellectLevel: 7, language: "English" },
        stream: false,
      });
    expect(res.status).toBe(200);
    expect(typeof res.body.aiResponse).toBe("string");
    expect(res.body.verse.id).toBe(verseId);
    expect(
      typeof res.body.confidence === "number" || res.body.confidence === null,
    ).toBe(true);
    expect(Array.isArray(res.body.citations)).toBe(true);
    expect(Array.isArray(res.body.sourceExcerpts)).toBe(true);
    // Skip if no tafsir data available (db was reset)
    if (res.body.noTafsirForSelectedScholars) {
      return;
    }
    expect(typeof res.body.runId).toBe("string");
    runId = res.body.runId;
  });

  it("POST /tafseer stream mode emits SSE events with runId", async () => {
    const verseRes = await request(app)
      .get("/verses")
      .query({ surahNumber: 1, verseNumber: 1 });
    const verseId = verseRes.body.id;
    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseId,
        filters: { tone: 7, intellectLevel: 7, language: "English" },
        stream: true,
      });

    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] || "")).toContain(
      "text/event-stream",
    );
    expect(res.text).toContain('"type":"start"');
    expect(res.text).toContain('"type":"complete"');
    // Skip if no tafsir data (db was reset)
    if (res.text.includes('"noTafsirForSelectedScholars":true')) {
      return;
    }
    expect(res.text).toContain('"runId"');
  });

  it("GET /tafseer/runs returns paginated runs for current user", async () => {
    // Skip if no runs exist (db was reset)
    if (!runId) {
      return;
    }
    const res = await request(app)
      .get("/tafseer/runs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(
      res.body.nextCursor === null || typeof res.body.nextCursor === "string",
    ).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.some((item: any) => item.runId === runId)).toBe(true);
  });

  it("GET /tafseer/runs/:runId returns run detail", async () => {
    // Skip if no run (db was reset)
    if (!runId) {
      return;
    }
    const res = await request(app)
      .get(`/tafseer/runs/${runId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.searchId).toBe(runId);
    expect(typeof res.body.aiResponse).toBe("string");
    expect(Array.isArray(res.body.citations)).toBe(true);
    expect(Array.isArray(res.body.sourceExcerpts)).toBe(true);
  });

  it("PATCH /tafseer/runs/:runId updates run metadata", async () => {
    // Skip if no run (db was reset)
    if (!runId) {
      return;
    }
    const res = await request(app)
      .patch(`/tafseer/runs/${runId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test run", starred: true, notes: "Updated by test" });

    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.title).toBe("Test run");
    expect(res.body.starred).toBe(true);
    expect(res.body.notes).toBe("Updated by test");
  });
});

describe("Tafseer result cache & fallback persistence (plan Faz 1)", () => {
  let token = "";
  let userId = "";

  beforeAll(async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: TEST_PASSWORD });
    token = login.body.token;
    const user = await prisma.user.findUnique({
      where: { email: "testuser@example.com" },
    });
    userId = user!.id;
  });

  it("serves a stored result from cache, before any retrieval", async () => {
    const filters = { language: "Turkish" };
    const cacheKey = buildTafsirCacheKey({
      verseId: SEED_VERSE_ID,
      surahNumber: 1,
      startVerse: 1,
      endVerse: 1,
      filters,
      language: "Turkish",
      userId,
    });
    const search = await prisma.search.create({
      data: {
        userId,
        verseId: SEED_VERSE_ID,
        query: {
          cacheKey,
          filters,
          verseRange: { surahNumber: 1, startVerse: 1, endVerse: 1 },
          sourceExcerpts: [],
        },
      },
    });
    await prisma.searchResult.create({
      data: {
        searchId: search.id,
        tafsirId: "seed-tafsir",
        aiResponse: "ÖNBELLEK YANITI",
        citations: [],
        confidenceScore: 0.5,
      },
    });

    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({ verseId: SEED_VERSE_ID, filters, stream: false });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.aiResponse).toBe("ÖNBELLEK YANITI");
    expect(res.body.searchId).toBe(search.id);
  });

  it("separates a range from the single verse it starts with (cache key regression)", async () => {
    // The single verse 1:1 is cached by the previous test. A 1:1–2 range
    // shares the first verse but must NOT reuse that answer.
    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseRange: { surahNumber: 1, startVerse: 1, endVerse: 2 },
        filters: { language: "Turkish" },
        stream: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBeUndefined();
    expect(res.body.aiResponse).not.toBe("ÖNBELLEK YANITI");
    // AI is disabled in tests, so the fresh path lands on the shown fallback.
    expect(res.body.fallback).toBe(true);
  });


  describe("Comparison endpoint", () => {
    it("validates the scholar pair and verse", async () => {
      const base = { verseId: SEED_VERSE_ID };
      const auth = { Authorization: `Bearer ${token}` };

      const noVerse = await request(app)
        .post("/tafseer/compare")
        .set(auth)
        .send({ scholars: ["1", "2"] });
      expect(noVerse.status).toBe(400);

      const oneScholar = await request(app)
        .post("/tafseer/compare")
        .set(auth)
        .send({ ...base, scholars: [String(SEED_MUFASSIR_ID)] });
      expect(oneScholar.status).toBe(400);

      const same = await request(app)
        .post("/tafseer/compare")
        .set(auth)
        .send({ ...base, scholars: ["1", "1"] });
      expect(same.status).toBe(400);
    });

    it("rejects with 422 when a scholar has no tafsir on the verse", async () => {
      const res = await request(app)
        .post("/tafseer/compare")
        .set("Authorization", `Bearer ${token}`)
        .send({
          verseId: SEED_VERSE_ID,
          scholars: [String(SEED_MUFASSIR_ID), "999999"],
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/999999/);
    });

    it("returns a labeled side-by-side fallback when generation is unavailable", async () => {
      await prisma.mufassir.upsert({
        where: { id: 900002 },
        update: {},
        create: {
          id: 900002,
          nameEn: "Second Test Mufassir",
          nameTr: "İkinci Test Müfessiri",
          nameAr: "مفسر ثانٍ",
          reputationScore: 7,
          century: 10,
          madhab: "Maliki",
          period: "CLASSICAL_MATURE",
        },
      });
      const existing = await prisma.tafsir.findFirst({
        where: { verseId: SEED_VERSE_ID, mufassirId: 900002 },
      });
      if (!existing) {
        await prisma.tafsir.create({
          data: {
            verseId: SEED_VERSE_ID,
            mufassirId: 900002,
            tafsirText: "قال المفسر الثاني: البسملة استفتاح للأمر وبركة في العمل.",
          },
        });
      }

      const res = await request(app)
        .post("/tafseer/compare")
        .set("Authorization", `Bearer ${token}`)
        .send({
          verseId: SEED_VERSE_ID,
          scholars: [String(SEED_MUFASSIR_ID), "900002"],
          language: "Turkish",
        });

      expect(res.status).toBe(200);
      // AI testlerde kapalı: dürüst geri çekilme etiketli yan yana pasajlar
      expect(res.body.fallback).toBe(true);
      expect(res.body.aiResponse).toContain("MÜFESSİR A");
      expect(res.body.aiResponse).toContain("MÜFESSİR B");
      expect(res.body.citations.length).toBeGreaterThanOrEqual(2);
      expect(res.body.sourceExcerpts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("GET /filters/scholars-for-verse", () => {
    it("lists only scholars with tafsir for the exact verse range", async () => {
      const hit = await request(app).get(
        "/filters/scholars-for-verse?surahNumber=1&startVerse=1&endVerse=1",
      );
      expect(hit.status).toBe(200);
      expect(hit.body.scholarIds).toContain(String(SEED_MUFASSIR_ID));

      // Tohumda 1:2 için satır yok — sure bazlı eski davranış bunu döndürürdü.
      const miss = await request(app).get(
        "/filters/scholars-for-verse?surahNumber=1&startVerse=2&endVerse=2",
      );
      expect(miss.status).toBe(200);
      expect(miss.body.scholarIds).not.toContain(String(SEED_MUFASSIR_ID));
    });
  });

  it("rejects verse ranges above the shared 10-verse limit", async () => {
    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseRange: { surahNumber: 1, startVerse: 1, endVerse: 11 },
        filters: { language: "Turkish" },
        stream: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum of 10 verses/);
  });

  it("accepts a range of exactly 10 verses (boundary)", async () => {
    const res = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        verseRange: { surahNumber: 1, startVerse: 1, endVerse: 10 },
        filters: { language: "Turkish" },
        stream: false,
      });

    // Doğrulama yalnız sayı sınırına bakar (tohumda Fâtiha'nın 7 ayeti var);
    // sınır içindeki istek 400 almamalı.
    expect(res.status).not.toBe(400);
  });

  it("does not persist fallback responses, so they cannot poison the cache (regression)", async () => {
    const body = {
      verseId: SEED_VERSE_ID,
      filters: { language: "Turkish", responseLength: 2 },
      stream: false,
    };
    const fallbackCountBefore = await prisma.searchResult.count({
      where: { aiResponse: { contains: "Fallback Response" } },
    });

    const first = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.fallback).toBe(true);

    // Same request immediately after: must be a fresh attempt, not the
    // fallback served from the 1-hour cache.
    const second = await request(app)
      .post("/tafseer")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBeUndefined();
    expect(second.body.fallback).toBe(true);

    const fallbackCountAfter = await prisma.searchResult.count({
      where: { aiResponse: { contains: "Fallback Response" } },
    });
    expect(fallbackCountAfter).toBe(fallbackCountBefore);

    const fallbackSnapshots = await prisma.academicSnapshot.count({
      where: { aiResponse: { contains: "Fallback Response" } },
    });
    expect(fallbackSnapshots).toBe(0);
  });
});

describe("Faz 1B security hardening", () => {
  it("SEC-01 regression: non-string idToken returns 400 and the process stays alive", async () => {
    for (const bad of [123, { x: 1 }, ["t"], null]) {
      const res = await request(app)
        .post("/auth/sso/google")
        .send({ idToken: bad });
      expect(res.status).toBe(400);
    }
    // Süreç hâlâ ayakta: basit bir istek daha.
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
  });

  it("wrong-typed login fields return 400", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: 42, password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("1B.5: short and oversized passwords are rejected", async () => {
    const shortRes = await request(app).post("/auth/register").send({
      email: `pw-test-${Date.now()}@example.com`,
      password: "short",
    });
    expect(shortRes.status).toBe(400);

    const longRes = await request(app).post("/auth/register").send({
      email: `pw-test2-${Date.now()}@example.com`,
      password: "ü".repeat(37), // 74 bytes > bcrypt 72-byte limit
    });
    expect(longRes.status).toBe(400);
  });

  it("1B.5: invalid email formats are rejected", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "not-an-email",
      password: "longenough123",
    });
    expect(res.status).toBe(400);
  });

  it("1B.2: requesting a new code invalidates the previous unused one (SEC-04 quick half)", async () => {
    const email = `oldcode-${Date.now()}@example.com`;
    await request(app).post("/auth/register").send({
      email,
      password: "initialpass1234",
    });
    const spy = mockRandomInt(100000, 222222);
    await request(app).post("/auth/password/reset/request").send({ email });
    await request(app).post("/auth/password/reset/request").send({ email });
    spy.mockRestore();

    // Eski kod artık geçersiz:
    const oldCode = await request(app)
      .post("/auth/password/reset/confirm")
      .send({ email, code: "100000", newPassword: "newpass12345" });
    expect(oldCode.status).toBe(400);

    // Yeni kod çalışır:
    const newCode = await request(app)
      .post("/auth/password/reset/confirm")
      .send({ email, code: "222222", newPassword: "newpass12345" });
    expect(newCode.status).toBe(200);
  });

  it("1B.8: repeated failed login attempts hit the rate limit (429)", async () => {
    const email = `limit-${Date.now()}@example.com`;
    await request(app).post("/auth/register").send({
      email,
      password: "validpassword1",
    });
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "wrongpassword" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("1B.8: too many failed reset confirmations are locked out (429)", async () => {
    const email = `lockout-${Date.now()}@example.com`;
    await request(app).post("/auth/register").send({
      email,
      password: "validpassword1",
    });
    const spy = mockRandomInt(999999);
    await request(app).post("/auth/password/reset/request").send({ email });
    spy.mockRestore();

    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/auth/password/reset/confirm")
        .send({ email, code: "100001", newPassword: "newpass12345" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);

    // Kontrol bulgusu 1: kilit, kod karşılaştırmasından ÖNCE uygulanır —
    // DOĞRU kod bile artık parolayı değiştiremez.
    const correctButLocked = await request(app)
      .post("/auth/password/reset/confirm")
      .send({ email, code: "999999", newPassword: "hacked12345" });
    expect(correctButLocked.status).toBe(429);

    // Parola gerçekten değişmedi:
    const login = await request(app)
      .post("/auth/login")
      .send({ email, password: "validpassword1" });
    expect(login.status).toBe(200);
  });

  it("1B.8: email counters use account normalization — case/whitespace variants cannot bypass limits", async () => {
    const email = `normlimit-${Date.now()}@example.com`;
    await request(app).post("/auth/register").send({
      email,
      password: "validpassword1",
    });
    // Aynı hesabın büyük/küçük harf ve boşluklu yazımları:
    const variants = [
      email.toUpperCase(),
      ` ${email} `,
      email.toUpperCase(),
      ` ${email.toUpperCase()} `,
      email,
    ];
    for (const variant of variants) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: variant, password: "wrongpassword" });
      expect([401, 429]).toContain(res.status);
    }
    // 5 deneme sayacı doldurdu; normalize edilmiş düz yazım da 429 almalı:
    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "wrongpassword" });
    expect(res.status).toBe(429);
  });

  it("1B.3 (SEC-07): an ownerless snapshot is denied by default", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: TEST_PASSWORD });
    const token = login.body.token;

    const created = await prisma.academicSnapshot.create({
      data: {
        snapshotId: `OWNERLESS-${Date.now()}`,
        verseId: SEED_VERSE_ID,
        queryText: "orphan",
        corpusVersion: "1.0",
        embeddingModel: "test",
        llmModel: "test",
        promptHash: "test",
        aiResponse: "private content",
        citationKey: "key",
        searchId: null,
      },
    });

    const res = await request(app)
      .get(`/tafseer/snapshots/${created.snapshotId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("private content");
  });
});
