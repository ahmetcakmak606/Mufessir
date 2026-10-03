// Runs as a vitest setupFile, BEFORE any test module (and therefore before the
// app's Prisma clients are constructed). Loads the same env files the app
// would, then forces a disposable, recognizably-test database target and
// disables live model calls. If the resolved target cannot be verified as a
// test database, tests abort instead of touching it.
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import {
  resolveTestDatabaseUrl,
  readPreparedTestDatabaseUrl,
  requireValidTestTarget,
} from "./test-db-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const envPath of [
  resolve(__dirname, "../../../../.env"),
  resolve(__dirname, "../../.env"),
]) {
  if (existsSync(envPath)) config({ path: envPath });
}

// Tests must never spend model budget or depend on live AI behavior.
delete process.env.OPENAI_API_KEY;
process.env.OPENAI_DISABLED = "1";
process.env.AI_MODE = "off";
process.env.SIMILARITY_MODE = process.env.SIMILARITY_MODE ?? "sample";
process.env.DEMO_MODE = "0";
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-secret";

// Under `npm test`, scripts/test-db.ts already prepared one shared database
// for the whole run (per TEST_RUN_ID state file); prefer it so per-file
// teardowns don't fight each other. Recorded targets pass the SAME
// validation as fresh ones — a stale/foreign state file aborts the run.
const preparedUrl = readPreparedTestDatabaseUrl();
if (preparedUrl) {
  requireValidTestTarget(preparedUrl);
  process.env.DATABASE_URL = preparedUrl;
} else {
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
  if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
}
