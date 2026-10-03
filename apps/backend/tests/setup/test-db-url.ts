// Pure URL-selection logic for the test env guard, kept separate so its
// "refuse to run against a non-test database" behavior is unit-testable.
// Also owns the run-level state files that let `npm test` prepare ONE
// disposable database per run and tear it down at the end.
//
// Safety invariants (2026-10-03 final control, 0.1a):
//  - Every entry path (explicit TEST_DATABASE_URL, derived URL, AND the
//    URL recorded in a state file) runs the same validation: test_ prefix,
//    safe identifier charset, local server unless TEST_ALLOW_NONLOCAL=1.
//  - State files are per-run (TEST_RUN_ID): two concurrent runs can never
//    clobber or delete each other's records or databases.
//  - The state records ownership; only databases created by the harness
//    are ever dropped. Adopted databases (TEST_ADOPT_EXISTING=1) never are.
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "../..");

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

export function isLocalHost(hostname: string): boolean {
  return [
    "localhost",
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ].includes(hostname.toLowerCase());
}

export function databaseNameFromUrl(url: URL): string {
  return url.pathname.replace(/^\//, "").split(/[/?]/)[0] ?? "";
}

export function requireTestDatabaseName(url: URL): string {
  const name = databaseNameFromUrl(url);
  if (!name.startsWith("test_")) {
    throw new Error(
      `Refusing to run tests against database "${name}". ` +
        `Test databases must be named with a "test_" prefix ` +
        `(set TEST_DATABASE_URL, or let tests derive one from a local DATABASE_URL).`,
    );
  }
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(
      `Test database name "${name}" contains characters outside [A-Za-z0-9_]; ` +
        `refusing to interpolate it into SQL identifiers.`,
    );
  }
  return name;
}

/** Full validation applied to EVERY entry path, including recorded targets. */
export function requireValidTestTarget(url: string): void {
  const parsed = new URL(url);
  requireTestDatabaseName(parsed);
  if (!isLocalHost(parsed.hostname) && process.env.TEST_ALLOW_NONLOCAL !== "1") {
    throw new Error(
      `Refusing to target non-local host "${parsed.hostname}". ` +
        `Use a local server, or set TEST_ALLOW_NONLOCAL=1 to override explicitly.`,
    );
  }
}

function requireLocalOrOverride(url: URL, env: NodeJS.ProcessEnv): void {
  if (isLocalHost(url.hostname) || env.TEST_ALLOW_NONLOCAL === "1") return;
  throw new Error(
    `Refusing to target non-local host "${url.hostname}". ` +
      `A dev Docker container holding data is not a disposable target by itself. ` +
      `Use a local server, or set TEST_ALLOW_NONLOCAL=1 to override explicitly.`,
  );
}

/**
 * Resolves the DATABASE_URL tests are allowed to use.
 * - An explicit TEST_DATABASE_URL must point at a `test_` database on a
 *   local (or explicitly allowed) server.
 * - Otherwise a per-process `test_mufessir_<pid>_<ts>` database is derived
 *   from a local DATABASE_URL.
 * - Returns null when no DATABASE_URL exists (DB-less unit tests stay runnable).
 */
export function resolveTestDatabaseUrl(
  env: NodeJS.ProcessEnv,
): string | null {
  if (env.TEST_DATABASE_URL) {
    const url = new URL(env.TEST_DATABASE_URL);
    requireTestDatabaseName(url);
    requireLocalOrOverride(url, env);
    return env.TEST_DATABASE_URL;
  }

  if (!env.DATABASE_URL) return null;

  const url = new URL(env.DATABASE_URL);
  requireLocalOrOverride(url, env);

  url.pathname = `/test_mufessir_${process.pid}_${Date.now()}`;
  return url.toString();
}

// --- Run-level state files (npm test flow, one per TEST_RUN_ID) ---

export interface TestDatabaseState {
  /** Full connection URL of the prepared database. */
  url: string;
  /** True only when this harness created the database (and may drop it). */
  owned: boolean;
  /** pid of the process that prepared it (informational). */
  pid: number;
  createdAt: string;
}

/**
 * Per-run state path. `npm test` exports TEST_RUN_ID before prepare, so
 * prepare, every test worker (via env-guard) and teardown all resolve the
 * SAME file within a run, while two concurrent runs resolve different files
 * and can never overwrite or delete each other's records.
 */
export function statePathFor(runId: string | undefined): string {
  const safe = runId && /^[A-Za-z0-9_-]+$/.test(runId) ? runId : null;
  return safe
    ? resolve(STATE_DIR, `.test-database-url-${safe}`)
    : resolve(STATE_DIR, ".test-database-url");
}

export function readTestDatabaseState(
  runId: string | undefined = process.env.TEST_RUN_ID,
): TestDatabaseState | null {
  try {
    const raw = readFileSync(statePathFor(runId), "utf8").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TestDatabaseState>;
    if (
      typeof parsed.url !== "string" ||
      typeof parsed.owned !== "boolean" ||
      typeof parsed.pid !== "number"
    ) {
      return null;
    }
    return {
      url: parsed.url,
      owned: parsed.owned,
      pid: parsed.pid,
      createdAt:
        typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    };
  } catch {
    return null;
  }
}

export function readPreparedTestDatabaseUrl(): string | null {
  return readTestDatabaseState()?.url ?? null;
}

export function writeTestDatabaseState(state: TestDatabaseState): void {
  writeFileSync(statePathFor(process.env.TEST_RUN_ID), JSON.stringify(state), "utf8");
}

export function clearPreparedTestDatabaseUrl(): void {
  const path = statePathFor(process.env.TEST_RUN_ID);
  if (existsSync(path)) unlinkSync(path);
}

export function listStaleStateFiles(): string[] {
  // Best effort: any state file that is not the current run's.
  const current = statePathFor(process.env.TEST_RUN_ID);
  try {
    return readdirSync(STATE_DIR)
      .filter(
        (name) =>
          name.startsWith(".test-database-url") &&
          resolve(STATE_DIR, name) !== current,
      )
      .map((name) => resolve(STATE_DIR, name));
  } catch {
    return [];
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Logs host/database without credentials — never print connection URLs. */
export function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}
