import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

afterAll(async () => {
  await prisma.$disconnect();
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
      password: "pass1234",
      name: "Tester",
    });
    expect([200, 201, 409]).toContain(res.status); // 409 if user exists
  });

  it("logs in and returns a token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "testuser@example.com", password: "pass1234" });
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
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
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
      .send({ email: "testuser@example.com", password: "pass1234" });
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
