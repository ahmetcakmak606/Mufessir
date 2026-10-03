// Disposable test database. The env guard (tests/setup/env-guard.ts) points
// DATABASE_URL at a `test_`-prefixed database before any app module loads.
// Two flows share this helper:
//  - `npm test` exports TEST_RUN_ID, prepares ONE database per run via
//    scripts/test-db.ts (state file .test-database-url-<run>) and tears it
//    down at the end. Per-run state files mean concurrent runs can never
//    clobber each other.
//  - Running a single file directly derives a per-process database and drops
//    it in afterAll — ONLY if this process created it. A database that
//    already existed is refused (or adopted with TEST_ADOPT_EXISTING=1) and
//    is NEVER dropped by the single-file flow.
//
// Safety invariants (2026-10-03 final control, 0.1a):
//  - Admin connections ALWAYS use the recorded/derived URL of this run;
//    recorded targets pass the same validation as fresh ones.
//  - Creation never drops: plain CREATE DATABASE; "already exists" stops
//    instead of dropping a database we did not create.
//  - Connection problems are classified (3D000 = missing; other errors
//    abort), and ownership decides who may drop.
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";
import {
  requireTestDatabaseName,
  requireValidTestTarget,
  readTestDatabaseState,
  writeTestDatabaseState,
  clearPreparedTestDatabaseUrl,
  listStaleStateFiles,
  maskDatabaseUrl,
} from "../setup/test-db-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../");
const SCHEMA_PATH = resolve(REPO_ROOT, "packages/database/prisma/schema.prisma");

type ProbeStatus = "ok" | "missing" | "error";
type Ownership = "created" | "adopted" | "run";

function currentEnvDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; cannot prepare a test database.");
  }
  return url;
}

/** Admin client bound to the SERVER of the given URL (never ambient env). */
function adminClientFor(url: string): Client {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  return new Client({ connectionString: adminUrl.toString() });
}

async function withAdmin<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const admin = adminClientFor(url);
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

/**
 * Distinguishes "database does not exist" from other connection failures.
 * Only "missing" may lead to creation; anything else must abort, otherwise
 * a transient error could fall through to a destructive operation.
 */
async function probeDatabase(url: string): Promise<{ status: ProbeStatus; errorCode?: string }> {
  try {
    const client = new Client({ connectionString: url });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return { status: "ok" };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "3D000") return { status: "missing", errorCode: code };
    return { status: "error", errorCode: code };
  }
}

function pushSchema(url: string): void {
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--schema", SCHEMA_PATH, "--skip-generate"],
    { cwd: REPO_ROOT, stdio: "pipe", env: { ...process.env, DATABASE_URL: url } },
  );
}

/**
 * Creates the database WITHOUT dropping anything first. If it already
 * exists (42P04 — e.g. a concurrent creator won the race), we stop rather
 * than replace a database this harness may not own.
 */
async function createDatabase(url: string): Promise<void> {
  const name = requireTestDatabaseName(new URL(url));
  try {
    await withAdmin(url, (admin) => admin.query(`CREATE DATABASE "${name}"`));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P04") {
      throw new Error(
        `Database ${maskDatabaseUrl(url)} appeared between probe and create. ` +
          `Refusing to drop or reuse it — rerun the tests.`,
      );
    }
    throw error;
  }

  // pgvector extension, mirroring docker/init.sql, so raw retrieval SQL
  // that references vector columns stays usable in tests.
  const bootstrap = new Client({ connectionString: url });
  await bootstrap.connect();
  try {
    await bootstrap.query("CREATE EXTENSION IF NOT EXISTS vector");
  } finally {
    await bootstrap.end();
  }

  pushSchema(url);
}

function warnAboutStaleState(): void {
  const stale = listStaleStateFiles();
  if (stale.length > 0) {
    console.warn(
      `Note: ${stale.length} state file(s) from other test runs found (possibly crashed runs). ` +
        `Their databases (if any) are left untouched; remove manually after verifying: ` +
        stale.map((p) => maskStatePath(p)).join(", "),
    );
  }
}

function maskStatePath(path: string): string {
  return path.split("/").pop() ?? path;
}

// Ownership of the database this vitest process works on.
let lifecycle: { url: string; ownership: Ownership } | null = null;

/**
 * Single-file flow entry: creates the disposable database if missing.
 * A database that already exists is REFUSED unless TEST_ADOPT_EXISTING=1,
 * and adopted databases are never dropped by this flow.
 */
export function ensureTestDatabase(): Promise<void> {
  if (lifecycle) return Promise.resolve();
  const url = currentEnvDatabaseUrl();
  requireTestDatabaseName(new URL(url));

  const promise = (async () => {
    // A run-level state file for THIS run means `npm test` prepared the
    // database: it is run-owned, per-file teardown must not touch it.
    const state = readTestDatabaseState();
    if (state && state.url === url) {
      requireValidTestTarget(state.url);
      lifecycle = { url, ownership: "run" };
      return;
    }
    if (state && state.url !== url) {
      throw new Error(
        `A state file for this run records a different target (${maskDatabaseUrl(state.url)}) ` +
          `than DATABASE_URL (${maskDatabaseUrl(url)}). Refusing to mix targets.`,
      );
    }

    const probe = await probeDatabase(url);
    if (probe.status === "ok") {
      if (process.env.TEST_ADOPT_EXISTING !== "1") {
        throw new Error(
          `Database ${maskDatabaseUrl(url)} already exists and was NOT created by this run. ` +
            `Refusing to adopt it silently. Set TEST_ADOPT_EXISTING=1 to reuse it — ` +
            `adopted databases are never dropped.`,
        );
      }
      requireValidTestTarget(url);
      pushSchema(url);
      lifecycle = { url, ownership: "adopted" };
      return;
    }
    if (probe.status === "missing") {
      await createDatabase(url);
      lifecycle = { url, ownership: "created" };
      return;
    }
    throw new Error(
      `Cannot verify test database at ${maskDatabaseUrl(url)} (error code ${probe.errorCode ?? "unknown"}). ` +
        `Aborting instead of creating/dropping blindly.`,
    );
  })();
  return promise;
}

/** Run-level prepare used by scripts/test-db.ts (`npm test` flow). */
export async function prepareTestDatabase(): Promise<{ url: string; owned: boolean }> {
  warnAboutStaleState();
  const url = currentEnvDatabaseUrl();
  requireValidTestTarget(url);

  const probe = await probeDatabase(url);
  let owned: boolean;
  if (probe.status === "ok") {
    if (process.env.TEST_ADOPT_EXISTING !== "1") {
      throw new Error(
        `Database ${maskDatabaseUrl(url)} already exists and was NOT created by this run. ` +
          `Refusing to adopt it (teardown would drop a database we do not own). ` +
          `Set TEST_ADOPT_EXISTING=1 to reuse it — adopted databases are never dropped.`,
      );
    }
    owned = false; // adopted: schema is pushed, but never dropped
    pushSchema(url);
  } else if (probe.status === "missing") {
    await createDatabase(url);
    owned = true;
  } else {
    throw new Error(
      `Cannot reach test server for ${maskDatabaseUrl(url)} (error code ${probe.errorCode ?? "unknown"}). Aborting.`,
    );
  }

  // State is written only after success; a failed prepare leaves no record,
  // so it can never cause another run's teardown to fire.
  writeTestDatabaseState({
    url,
    owned,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });
  console.log(
    `Test database ready: ${maskDatabaseUrl(url)} (${owned ? "created by this run" : "adopted, will NOT be dropped"})`,
  );
  return { url, owned };
}

async function dropOwnedDatabase(url: string): Promise<void> {
  const name = requireTestDatabaseName(new URL(url));
  await withAdmin(url, async (admin) => {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [name],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  });
}

/**
 * Run-level teardown used by scripts/test-db.ts. Connects to the server
 * recorded in the state file (never re-derived from ambient env) and drops
 * the database only when this harness created it. The state file is removed
 * only after successful handling; a failed cleanup keeps the record AND
 * throws, so the npm script exits non-zero and the failure stays visible.
 */
export async function teardownPreparedDatabase(): Promise<void> {
  const state = readTestDatabaseState();
  if (!state) return;

  if (!state.owned) {
    console.warn(
      `Test database ${maskDatabaseUrl(state.url)} was adopted (pre-existing); leaving it in place.`,
    );
    clearPreparedTestDatabaseUrl();
    return;
  }

  try {
    requireValidTestTarget(state.url);
    await dropOwnedDatabase(state.url);
    clearPreparedTestDatabaseUrl();
    console.log(`Test database dropped: ${maskDatabaseUrl(state.url)}`);
  } catch (error) {
    // Keep the state file so the leftover database stays discoverable and
    // rethrow so the CLI exits non-zero (visible failure).
    console.error(
      `FAILED to drop test database ${maskDatabaseUrl(state.url)}; state file kept for manual cleanup:`,
      error,
    );
    throw error;
  }
}

/**
 * Per-file teardown for direct single-file runs. Drops ONLY what this
 * process created; adopted databases are never dropped here, and run-owned
 * databases (npm test flow) are left to the run-level script.
 */
export async function dropTestDatabase(): Promise<void> {
  const current = lifecycle;
  lifecycle = null;
  if (!current) return;
  if (current.ownership !== "created") {
    if (current.ownership === "adopted") {
      console.warn(
        `Test database ${maskDatabaseUrl(current.url)} was adopted (pre-existing); not dropping it.`,
      );
    }
    return;
  }
  try {
    await dropOwnedDatabase(current.url);
  } catch (error) {
    // Best effort teardown: never fail a test run because cleanup failed,
    // but make it visible.
    console.warn("Test database cleanup failed:", error);
  }
}
