// Run-level test database lifecycle for `npm test`:
//   tsx scripts/test-db.ts prepare  — resolve/create one shared test DB,
//                                     record it (URL + ownership) in the
//                                     per-run state file
//   tsx scripts/test-db.ts teardown — drop it (only if we created it) and
//                                     remove the state file
// Both modes connect to the server recorded/derived for THIS run; ambient
// environment never re-targets a different server. The TEST_DATABASE_URL
// shortcut is deliberately absent: every target goes through the same
// validation (test_ prefix, identifier charset, locality).
import { existsSync } from "fs";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  prepareTestDatabase,
  teardownPreparedDatabase,
} from "../tests/helpers/test-db.js";
import { resolveTestDatabaseUrl } from "../tests/setup/test-db-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../.env"),
]) {
  if (existsSync(envPath)) config({ path: envPath });
}

const mode = process.argv[2];

if (mode === "prepare") {
  // Single derivation path with full validation — no bypassing shortcut.
  const url = resolveTestDatabaseUrl(process.env);
  if (!url) {
    console.error(
      "No DATABASE_URL/TEST_DATABASE_URL available to prepare a test database.",
    );
    process.exit(1);
  }
  process.env.DATABASE_URL = url;
  await prepareTestDatabase();
} else if (mode === "teardown") {
  try {
    await teardownPreparedDatabase();
  } catch {
    // Failure already logged with the kept state file; exit non-zero so the
    // npm script surfaces it (tests' own exit code is combined there).
    process.exit(1);
  }
} else {
  console.error("Usage: tsx scripts/test-db.ts <prepare|teardown>");
  process.exit(1);
}
