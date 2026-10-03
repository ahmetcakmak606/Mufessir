import { describe, it, expect } from "vitest";
import {
  resolveTestDatabaseUrl,
  maskDatabaseUrl,
  requireTestDatabaseName,
  statePathFor,
} from "./setup/test-db-url.js";

describe("test database guard (wrong-target abort)", () => {
  it("accepts an explicit TEST_DATABASE_URL pointing at a local test_ database", () => {
    const url = resolveTestDatabaseUrl({
      TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test_mufessir_ci",  // check-secrets: allow
    });
    expect(url).toBe("postgresql://postgres:postgres@localhost:5432/test_mufessir_ci");  // check-secrets: allow
  });

  it("refuses an explicit TEST_DATABASE_URL pointing at a non-test database", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mufessir",  // check-secrets: allow
      }),
    ).toThrow(/Refusing to run tests against database "mufessir"/);
  });

  it("refuses an explicit TEST_DATABASE_URL on a non-local server too (2026-10-03 control fix)", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/test_shared",  // check-secrets: allow
      }),
    ).toThrow(/non-local host "db\.example\.com"/);
  });

  it("accepts a non-local explicit target only with an explicit override", () => {
    const url = resolveTestDatabaseUrl({
      TEST_DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/test_shared",  // check-secrets: allow
      TEST_ALLOW_NONLOCAL: "1",
    });
    expect(url).toContain("db.example.com");
  });

  it("rejects database names unsafe as SQL identifiers", () => {
    expect(() =>
      requireTestDatabaseName(
        new URL("postgresql://u:p@localhost:5432/test_x\";DROP--"),  // check-secrets: allow
      ),
    ).toThrow(/outside \[A-Za-z0-9_\]/);
  });

  it("masks credentials when describing a target URL", () => {
    const masked = maskDatabaseUrl(
      "postgresql://postgres:secret@localhost:5432/test_mufessir_1",  // check-secrets: allow
    );
    expect(masked).toBe("localhost:5432/test_mufessir_1");
    expect(masked).not.toContain("secret");
  });

  it("derives a per-process test_ database from a local DATABASE_URL", () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/mufessir",  // check-secrets: allow
    });
    expect(url).toMatch(
      new RegExp(`^postgresql://postgres:postgres@127\\.0\\.0\\.1:5432/test_mufessir_${process.pid}_\\d+$`),  // check-secrets: allow
    );
  });

  it("preserves query parameters when deriving a test database", () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/mufessir?schema=public&connection_limit=5",  // check-secrets: allow
    });
    expect(url).toMatch(
      new RegExp(`/test_mufessir_${process.pid}_\\d+\\?schema=public&connection_limit=5$`),
    );
  });

  it("refuses to derive a test database from a non-local host", () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/mufessir",  // check-secrets: allow
      }),
    ).toThrow(/non-local host "db\.example\.com"/);
  });

  it("allows a non-local host only with an explicit override", () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/mufessir",  // check-secrets: allow
      TEST_ALLOW_NONLOCAL: "1",
    });
    expect(url).toContain("db.example.com");
    expect(url).toMatch(new RegExp(`/test_mufessir_${process.pid}_\\d+`));
  });

  it("returns null without any DATABASE_URL so DB-less unit tests still run", () => {
    expect(resolveTestDatabaseUrl({})).toBeNull();
  });
});

describe("per-run state files (0.1a concurrency)", () => {
  it("separates state files per run id so concurrent runs cannot clobber each other", () => {
    const a = statePathFor("run_111_1");
    const b = statePathFor("run_222_2");
    expect(a).not.toBe(b);
    expect(a).toContain(".test-database-url-run_111_1");
  });

  it("falls back to a single legacy state file when no run id is set", () => {
    expect(statePathFor(undefined)).toMatch(/\.test-database-url$/);
  });

  it("rejects run ids unsafe as file names", () => {
    // Unsafe ids must not be interpolated into paths; they fall back to the
    // legacy single file rather than creating arbitrary paths.
    expect(statePathFor("../evil")).toMatch(/\.test-database-url$/);
  });
});
