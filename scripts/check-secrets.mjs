#!/usr/bin/env node
// Secret scan for tracked/staged/untracked files (plan S.0.4).
// Detects credential-bearing URLs (the class leaked in the seven import
// scripts), key material and token prefixes. Findings are printed MASKED
// (scheme + host only) — this script must never echo secret values.
//
// 2026-10-03 control fixes:
//  - --staged scans the INDEX content (git show :file), not the working
//    tree, so a staged secret cannot be hidden by later edits.
//  - The credential-URL allowlist parses the URL and requires an EXACT
//    (scheme-less) local host + the known dev credential pair; substring
//    matching let `postgres:postgres@db.example.invalid` pass.
//  - The default scan also covers untracked (non-ignored) files, not just
//    files already tracked.
//
// Usage:
//   node scripts/check-secrets.mjs            # tracked + untracked files
//   node scripts/check-secrets.mjs --staged   # staged content only (pre-commit)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);
const SAFE_DEV_CREDENTIALS = new Set(["postgres:postgres"]);

/** Structured allowlist: exact local host AND the known dev credential pair. */
function isSafeCredentialUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!LOCAL_HOSTS.has(host)) return false;
    const creds = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    return SAFE_DEV_CREDENTIALS.has(creds);
  } catch {
    return false;
  }
}

const PATTERNS = [
  {
    name: "credential-url",
    regex:
      /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|ftp|ftps):\/\/[^\s"'`@/]+:[^\s"'`@/]+@[^\s"'`]+/g,
    mask: (m) => {
      const scheme = m.split("://")[0];
      let host = "";
      try {
        host = new URL(m).hostname;
      } catch {
        host = m.split("@").pop()?.split(/[:/?]/)[0] ?? "";
      }
      return `${scheme}://***@${host}`;
    },
    allowed: isSafeCredentialUrl,
  },
  {
    name: "private-key-block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    mask: () => "-----BEGIN PRIVATE KEY-----",
    allowed: () => false,
  },
  {
    name: "aws-access-key-id",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    mask: () => "AKIA****************",
    allowed: () => false,
  },
  {
    name: "known-token-prefix",
    regex: /\b(?:ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|sk-[A-Za-z0-9]{20,})\b/g,
    mask: (m) => `${m.slice(0, 6)}***`,
    allowed: () => false,
  },
];

const EXCLUDE = [
  /^package-lock\.json$/,
  /(^|\/)node_modules\//,
  /(^|\/)coverage\//,
  /(^|\/)dist\//,
  /(^|\/)\.next\//,
  /^.*\.min\.(js|css)$/,
  // The scanner's own pattern definitions self-match.
  /^scripts\/check-secrets\.mjs$/,
];

// Conscious, reviewable opt-out for intentional fixtures and documentation
// that quotes secret SHAPES (never values). The marker must sit on the same
// line as the fixture.
const LINE_ALLOW_MARKER = "check-secrets: allow";

function listFiles(staged) {
  if (staged) {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
      { encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean);
  }
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  return [...tracked.split("\n"), ...untracked.split("\n")].filter(Boolean);
}

/** The content as staged in the index — what a commit would actually ship. */
function readStagedContent(file) {
  try {
    return execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

let findings = 0;
const staged = process.argv.includes("--staged");
const files = listFiles(staged);
for (const file of files) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  let content;
  if (staged) {
    content = readStagedContent(file);
  } else {
    try {
      content = readFileSync(file, "utf8");
    } catch {
      content = null;
    }
  }
  if (content === null || content === undefined) continue;
  const lines = content.split("\n");
  for (const { name, regex, mask, allowed } of PATTERNS) {
    lines.forEach((line, i) => {
      if (line.includes(LINE_ALLOW_MARKER)) return;
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        const raw = match[0];
        if (allowed(raw)) continue;
        findings++;
        console.error(`SECRET ${name} ${file}:${i + 1} ${mask(raw)}`);
      }
    });
  }
}

if (findings > 0) {
  console.error(
    `\ncheck-secrets: ${findings} finding(s). Remove the secret, rotate it if it was ever committed, and use environment variables instead.`,
  );
  process.exit(1);
}
console.log(`check-secrets: clean (${files.length} file(s) scanned).`);
