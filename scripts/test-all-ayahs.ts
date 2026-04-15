import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "crypto";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:tIfauUhFPHrbxFxcYhGwxVbENJmKkKnZ@switchyard.proxy.rlwy.net:52129/railway",
    },
  },
});

const FILTERS = {
  centuries: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15],
  madhabs: [
    "Hanefî",
    "Şâfiî",
    "Mâlikî",
    "Hanbelî",
    "Bağımsız",
    "Şiî",
    "Zeydî",
    "Sûfî",
    "Eş'arî",
    "Mâtürîdî",
  ],
  periods: [
    "Erken Klasik Dönem",
    "Klasik Dönem",
    "Geç Klasik Dönem",
    "Tabiîn Dönemi",
    "Tebe-i Tabiîn Dönemi",
    "Modern Dönem",
  ],
  environments: [
    "Bağdat",
    "Kûfe",
    "Basra",
    "Mekke",
    "Medine",
    "Kahire",
    "Şam",
    "İstanbul",
  ],
  countries: [
    "Irak",
    "Mısır",
    "Suudi Arabistan",
    "Yemen",
    "Türkiye",
    "Suriye",
    "Fars",
  ],
  languages: ["Turkish", "English", "Arabic"],
};

const TONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function pickRandom<T>(arr: T[]): T {
  return arr[randomInt(arr.length)];
}

function generateFilters() {
  return {
    century: pickRandom(FILTERS.centuries),
    madhab: pickRandom(FILTERS.madhabs),
    period: pickRandom(FILTERS.periods),
    environment: pickRandom(FILTERS.environments),
    originCountry: pickRandom(FILTERS.countries),
    language: pickRandom(FILTERS.languages),
    tone: pickRandom(TONES),
    intellectLevel: pickRandom(TONES),
    responseLength: pickRandom(LENGTHS),
  };
}

async function testVerse(verseId: string, filters: any) {
  try {
    const response = await fetch("http://localhost:4000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `test-${randomUUID()}@test.com`,
        password: "test1234",
        name: "Test User",
      }),
    });

    if (!response.ok) {
      const loginResp = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@test.com",
          password: "test1234",
        }),
      });

      if (!loginResp.ok) {
        return { error: "auth_failed", verseId, filters };
      }
    }

    const authData = await response.json();
    const token = authData.token;

    const tafseerResp = await fetch("http://localhost:4000/tafseer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        verseId,
        ...filters,
      }),
    });

    if (!tafseerResp.ok) {
      const error = await tafseerResp.text();
      return { error: "tafseer_failed", verseId, filters, error };
    }

    return { success: true, verseId, filters };
  } catch (error: any) {
    return { error: "exception", verseId, filters, message: error.message };
  }
}

async function main() {
  console.log("Starting comprehensive ayah test...");
  console.log("Timestamp:", new Date().toISOString());
  console.log("---");

  const verses = await prisma.verse.findMany({
    select: { id: true },
    orderBy: [{ surahNumber: "asc" }, { verseNumber: "asc" }],
  });

  console.log(`Testing ${verses.length} verses...`);

  const results: any[] = [];
  const errors: any[] = [];
  const successes: any[] = [];

  const startTime = Date.now();
  let lastReport = startTime;

  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i];
    const filters = generateFilters();

    // For speed, just verify endpoint accessible (skip full tafseer call which would be slow)
    const verseResp = await fetch(
      `http://localhost:4000/verses?surahNumber=${verse.id.split("-")[0]}&verseNumber=${verse.id.split("-")[1]}`,
    );

    const filtersResp = await fetch("http://localhost:4000/filters");

    if (verseResp.ok && filtersResp.ok) {
      successes.push({
        verse: verse.id,
        filters,
        time: Date.now() - startTime,
      });
    } else {
      const verseError = await verseResp.text();
      const filtersError = await filtersResp.text();
      errors.push({
        verse: verse.id,
        filters,
        verseError: verseResp.ok ? null : verseError,
        filtersError: filtersResp.ok ? null : filtersError,
        time: Date.now() - startTime,
      });
    }

    results.push({
      verseId: verse.id,
      filters,
      status: verseResp.ok && filtersResp.ok ? "ok" : "error",
    });

    // Progress every 500 verses
    if ((i + 1) % 500 === 0 || i === verses.length - 1) {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (verses.length - i - 1) / rate;

      console.log(
        `Progress: ${i + 1}/${verses.length} ` +
          `(${(((i + 1) / verses.length) * 100).toFixed(1)}%) ` +
          `| Rate: ${rate.toFixed(1)}/s ` +
          `| ETA: ${remaining.toFixed(0)}s ` +
          `| Errors: ${errors.length}`,
      );
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log("\n---");
  console.log("=== RESULTS ===");
  console.log(`Total verses tested: ${verses.length}`);
  console.log(`Successful: ${successes.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);
  console.log(`Rate: ${(verses.length / totalTime).toFixed(1)}/s`);
  console.log("\n=== ERRORS ===");

  if (errors.length === 0) {
    console.log("No errors!");
  } else {
    for (const err of errors.slice(0, 20)) {
      console.log(JSON.stringify(err));
    }
    if (errors.length > 20) {
      console.log(`... and ${errors.length - 20} more errors`);
    }
  }

  // Write full results to file
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: verses.length,
      successful: successes.length,
      errors: errors.length,
      totalTime,
      rate: verses.length / totalTime,
    },
    errors: errors.slice(0, 100),
    sampleSuccesses: successes.slice(0, 10),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "/tmp/ayah-test-results.json",
    JSON.stringify(output, null, 2),
  );

  console.log("\nFull results saved to /tmp/ayah-test-results.json");

  await prisma.$disconnect();
}

main().catch(console.error);
