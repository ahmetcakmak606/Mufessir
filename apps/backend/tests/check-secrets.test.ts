import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Behavioral tests for scripts/check-secrets.mjs (S.0.4) in a throwaway git
// repository — mirrors the 2026-10-03 control findings: staged content must
// be scanned (not the working tree), and the dev-URL allowlist must not let
// remote hosts through substring matches.
const SCRIPT = fileURLToPath(
  new URL("../../../scripts/check-secrets.mjs", import.meta.url),
);

let repo: string;

function git(...args: string[]) {
  const res = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return res.stdout;
}

function scan(...args: string[]) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  return {
    status: res.status ?? -1,
    output: `${res.stdout}\n${res.stderr}`,
  };
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "mufessir-secrets-"));
  git("init", "-q");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

// Tests share one throwaway repo; reset the index and remove leftover
// files so earlier fixtures cannot contaminate later scans.
afterEach(() => {
  spawnSync("git", ["reset", "-q"], { cwd: repo });
  for (const name of [
    "config.ts",
    "remote.ts",
    "local.ts",
    "untracked.ts",
    "clean.ts",
  ]) {
    const path = join(repo, name);
    if (existsSync(path)) unlinkSync(path);
  }
});

describe("check-secrets (S.0.4 + 2026-10-03 control fixes)", () => {
  it("scans the STAGED content — later working-tree edits cannot hide a staged secret", () => {
    writeFileSync(
      join(repo, "config.ts"),
      'const db = "postgresql://app:RealPass@db.example.invalid/prod";\n',  // check-secrets: allow
    );
    git("add", "config.ts");
    // Simulate "cleaning" the file after staging it:
    writeFileSync(join(repo, "config.ts"), "const db = process.env.DB_URL;\n");

    const res = scan("--staged");
    expect(res.status).toBe(1);
    expect(res.output).toContain("config.ts:1");
    expect(res.output).toContain("db.example.invalid");  // check-secrets: allow
    expect(res.output).not.toContain("RealPass");
  });

  it("does NOT allowlist remote hosts that merely contain a dev substring", () => {
    writeFileSync(
      join(repo, "remote.ts"),
      'const db = "postgresql://postgres:postgres@db.example.invalid/x";\n',  // check-secrets: allow
    );
    git("add", "remote.ts");
    const res = scan("--staged");
    expect(res.status).toBe(1);
    expect(res.output).toContain("remote.ts");
  });

  it("still allows genuine local dev URLs", () => {
    writeFileSync(
      join(repo, "local.ts"),
      'const db = "postgresql://postgres:postgres@localhost:5432/mufessir";\n',
    );
    git("add", "local.ts");
    const res = scan("--staged");
    expect(res.status).toBe(0);
  });

  it("covers untracked files in the full scan", () => {
    writeFileSync(
      join(repo, "untracked.ts"),
      'const key = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl";\n',  // check-secrets: allow
    );
    const res = scan();
    expect(res.status).toBe(1);
    expect(res.output).toContain("untracked.ts");
  });

  it("passes on a clean repository", () => {
    writeFileSync(join(repo, "clean.ts"), "export const ok = true;\n");
    git("add", "clean.ts");
    const res = scan();
    expect(res.status).toBe(0);
  });
});
