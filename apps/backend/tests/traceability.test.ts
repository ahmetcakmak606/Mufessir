import { describe, expect, it, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface BoardItem {
  id: string;
  task: string;
  status: string;
  priority: string;
  layer: string;
  estimate: string;
  dependency: string;
}

interface PdfExtractResult {
  pages: string[];
  fullText: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../../..");

const BOARD_PATH = resolve(REPO_ROOT, "MufessirAI_Project_Board_1.xlsx");
const CLAUDE_PDF_PATH = resolve(REPO_ROOT, "Claude.pdf");
const BOARD_EXTRACTOR = resolve(REPO_ROOT, "apps/backend/scripts/extract_board_items.py");
const PDF_EXTRACTOR = resolve(REPO_ROOT, "apps/backend/scripts/extract_claude_pdf_text.py");

const TARGET_BOARD_STATUSES = new Set(["DONE", "IN PROGRESS"]);

const fileCache = new Map<string, string>();
function readRepoFile(relativePath: string): string {
  const fullPath = resolve(REPO_ROOT, relativePath);
  if (!fileCache.has(fullPath)) {
    fileCache.set(fullPath, readFileSync(fullPath, "utf8"));
  }
  return fileCache.get(fullPath)!;
}

function parseJsonFile(relativePath: string): any {
  return JSON.parse(readRepoFile(relativePath));
}

function expectFileExists(relativePath: string): void {
  expect(existsSync(resolve(REPO_ROOT, relativePath)), `${relativePath} should exist`).toBe(true);
}

function expectFileContains(relativePath: string, needle: string): void {
  expect(readRepoFile(relativePath), `${relativePath} should include: ${needle}`).toContain(needle);
}

function expectFileMatches(relativePath: string, pattern: RegExp): void {
  expect(
    pattern.test(readRepoFile(relativePath)),
    `${relativePath} should match: ${pattern.toString()}`
  ).toBe(true);
}

function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[çÇ]/g, "c")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function runPythonJson<T>(scriptPath: string, args: string[]): T {
  const stdout = execFileSync("python3", [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

const checks: Record<string, () => void> = {
  monorepo_workspace() {
    expectFileExists("turbo.json");
    const pkg = parseJsonFile("package.json");
    expect(Array.isArray(pkg.workspaces)).toBe(true);
    expect(pkg.workspaces).toContain("apps/*");
    expect(pkg.workspaces).toContain("packages/*");
  },

  vercel_config_present() {
    expectFileExists("apps/frontend/vercel.json");
  },

  jwt_auth_routes_and_tokens() {
    expectFileContains("apps/backend/src/routes/auth.ts", 'router.post("/register"');
    expectFileContains("apps/backend/src/routes/auth.ts", 'router.post("/login"');
    expectFileContains("apps/backend/src/routes/auth.ts", 'router.get("/me"');
    expectFileContains("apps/backend/src/routes/auth.ts", "jwt.sign(");
    expectFileContains("apps/backend/src/middleware/auth.ts", "jwt.verify(");
  },

  openai_gpt4omini_integration() {
    expectFileContains("apps/backend/src/utils/openai.ts", "new OpenAI");
    expectFileContains("apps/backend/src/utils/openai.ts", "gpt-4o-mini");
    expectFileContains("apps/backend/src/utils/openai.ts", "generateTafsirStream");
    expectFileContains("apps/backend/src/utils/openai.ts", "generateTafsirNonStreaming");
  },

  sse_streaming_enabled() {
    expectFileContains("apps/backend/src/routes/tafseer.ts", "text/event-stream");
    expectFileContains("apps/backend/src/routes/tafseer.ts", "res.write(`data:");
  },

  pgvector_schema_and_migration() {
    expectFileContains(
      "packages/database/prisma/schema.prisma",
      'embedding      Unsupported("vector(1536)")?'
    );
    expectFileContains(
      "packages/database/prisma/migrations/20250713215944_add_embedding_column/migration.sql",
      "CREATE EXTENSION IF NOT EXISTS vector;"
    );
    expectFileContains(
      "packages/database/prisma/migrations/20250713215944_add_embedding_column/migration.sql",
      "vector(1536)"
    );
  },

  sample_data_and_route_tests_present() {
    expectFileExists("apps/backend/scripts/insert-sample-data.js");
    expectFileContains("apps/backend/tests/app.test.ts", "describe('Filters & Verses'");
    expectFileContains("apps/backend/tests/app.test.ts", "describe('Tafseer'");
  },

  scholar_model_and_import_pipeline_present() {
    expectFileContains("packages/database/prisma/schema.prisma", "model Scholar {");
    expectFileContains("packages/database/prisma/schema.prisma", "model Tafsir {");
    expectFileExists("apps/backend/scripts/import-mysql-dump.ts");
  },

  dashboard_queries_filters_and_tafseer() {
    expectFileContains("apps/frontend/src/lib/tafseer.ts", "/filters");
    expectFileContains("apps/frontend/src/lib/tafseer.ts", "/tafseer");
    expectFileContains("apps/frontend/src/app/dashboard/query/page.tsx", "tone");
    expectFileContains("apps/frontend/src/app/dashboard/query/page.tsx", "intellectLevel");
  },

  tr_en_language_support_present() {
    expectFileContains("apps/frontend/src/locales/index.ts", "tr:");
    expectFileContains("apps/frontend/src/locales/index.ts", "en:");
    expectFileContains("apps/frontend/src/context/LangContext.tsx", "setLang");
  },

  daily_quota_enforced() {
    expectFileContains("apps/backend/src/routes/auth.ts", "FREE_DAILY_QUOTA");
    expectFileContains("apps/backend/src/middleware/auth.ts", "enforceQuota");
    expectFileContains("apps/backend/src/middleware/auth.ts", "decrementQuota");
  },

  vitest_supertest_teststack_present() {
    const backendPkg = parseJsonFile("apps/backend/package.json");
    expect(backendPkg.scripts.test).toBe("vitest run");
    expect(backendPkg.devDependencies.vitest).toBeTruthy();
    expect(backendPkg.devDependencies.supertest).toBeTruthy();
    expectFileExists("apps/backend/vitest.config.ts");
  },

  ip01_bilmen_csv_pipeline_evidence() {
    expectFileContains("MufessirAI_Metadata_Framework.md", "IP01 kapsamında CSV'ye aktarılıyor");
    expectFileExists("apps/backend/scripts/import-mysql-dump.ts");
  },

  ip02_validation_and_consolidation_scripts() {
    expectFileExists("apps/backend/scripts/import-mysql-dump.ts");
    expectFileExists("apps/backend/scripts/check-scholar-data-quality.ts");
    expectFileContains("apps/backend/scripts/check-scholar-data-quality.ts", "dependencyReport");
  },

  ip03_prompt_system_traceability_rules() {
    expectFileContains("apps/backend/src/utils/prompt.ts", "Academic Source Hints");
    expectFileContains("apps/backend/src/utils/prompt.ts", "Keep statements traceable");
    expectFileContains("apps/backend/src/utils/openai.ts", "traceable to cited scholars");
  },

  scholar_metadata_fields_in_schema() {
    const schema = readRepoFile("packages/database/prisma/schema.prisma");
    [
      "mufassirTr",
      "mufassirNameLong",
      "tafsirType1",
      "tafsirType2",
      "explanation",
      "detailInformation",
      "bookId",
      "madhab",
      "environment",
      "originCountry",
      "scholarlyInfluence",
      "methodologicalRigor",
      "corpusBreadth",
      "traditionAcceptance",
      "sourceAccessibility",
      "reputationScore",
    ].forEach((field) => expect(schema).toContain(field));
  },

  scholar_period_enum_values() {
    const schema = readRepoFile("packages/database/prisma/schema.prisma");
    [
      "enum ScholarPeriod",
      "FOUNDATION",
      "CLASSICAL_EARLY",
      "CLASSICAL_MATURE",
      "POST_CLASSICAL",
      "MODERN",
      "CONTEMPORARY",
    ].forEach((token) => expect(schema).toContain(token));
  },

  tradition_acceptance_enum_values() {
    const schema = readRepoFile("packages/database/prisma/schema.prisma");
    [
      "enum TraditionAcceptance",
      "SUNNI_MAINSTREAM",
      "MUTAZILI",
      "SHII_IMAMI",
      "SHII_ZAYDI",
      "SUFI_ISHARI",
      "IBADI",
      "SALAFI",
      "CROSS_TRADITION",
    ].forEach((token) => expect(schema).toContain(token));
  },

  source_accessibility_enum_values() {
    const schema = readRepoFile("packages/database/prisma/schema.prisma");
    [
      "enum SourceAccessibility",
      "FULL_DIGITAL",
      "PARTIAL_DIGITAL",
      "MANUSCRIPT_ONLY",
      "LOST",
    ].forEach((token) => expect(schema).toContain(token));
  },

  scholar_reference_model_and_usage() {
    expectFileContains("packages/database/prisma/schema.prisma", "model ScholarReference {");
    expectFileContains("apps/backend/src/routes/tafseer.ts", "loadCitations");
    expectFileContains("apps/backend/src/routes/tafseer.ts", "scholarReference.findMany");
  },

  search_result_citations_confidence_schema() {
    expectFileContains("packages/database/prisma/schema.prisma", "citations       Json?");
    expectFileContains("packages/database/prisma/schema.prisma", "confidenceScore Float?");
    expectFileContains(
      "packages/database/prisma/migrations/20260305213023_citable_core_schema/migration.sql",
      'ALTER TABLE "SearchResult" ADD COLUMN     "citations" JSONB'
    );
  },

  deterministic_derivation_functions_present() {
    expectFileContains("apps/backend/src/utils/scholar-metadata.ts", "deriveCenturyFromHijri");
    expectFileContains("apps/backend/src/utils/scholar-metadata.ts", "derivePeriodCode");
    expectFileContains("apps/backend/src/utils/scholar-metadata.ts", "deriveSourceAccessibility");
    expectFileContains("apps/backend/scripts/derive-scholar-metadata.ts", "computeCompatibilityReputationScore");
  },

  filters_api_exposes_normalized_dimensions() {
    expectFileContains("apps/backend/src/routes/filters.ts", "periodCodes");
    expectFileContains("apps/backend/src/routes/filters.ts", "sourceAccessibilities");
    expectFileContains("apps/backend/src/routes/filters.ts", "traditions");
    expectFileContains("apps/backend/src/routes/filters.ts", "tafsirTypes");
    expectFileContains("apps/backend/src/routes/filters.ts", "deathHijriRange");
  },

  tafseer_payload_includes_citations_confidence_stream_and_json() {
    const route = readRepoFile("apps/backend/src/routes/tafseer.ts");
    expect(route).toContain("type: 'complete'");
    expect(route).toContain("confidence");
    expect(route).toContain("citations");
    expect(route).toContain("sourceExcerpts");
  },

  compatibility_reputation_score_computation_present() {
    expectFileContains("apps/backend/src/utils/scholar-metadata.ts", "computeCompatibilityReputationScore");
    expectFileContains("apps/backend/src/utils/scholar-metadata.ts", "return Number(avg.toFixed(1));");
  },

  ci_minimal_path_present() {
    const ci = readRepoFile(".github/workflows/ci.yml");
    ["Run migrations", "Seed sample data", "Lint", "Type-check", "Backend tests"].forEach((step) =>
      expect(ci).toContain(step)
    );
  },

  managed_db_handoff_artifacts_present() {
    expectFileExists("docs/MANAGED_DB_MIGRATION_RUNBOOK.md");
    expectFileExists("scripts/db-dump.sh");
    expectFileExists("scripts/db-restore.sh");
  },

  t17_baseline_documented() {
    expectFileExists("docs/T17_API_READINESS_BASELINE.md");
    expectFileContains("docs/T17_API_READINESS_BASELINE.md", "POST /tafseer");
    expectFileContains("docs/T17_API_READINESS_BASELINE.md", "GET /filters");
  },
};

const BOARD_ITEM_CHECKS: Record<string, string[]> = {
  D01: ["monorepo_workspace"],
  D02: ["vercel_config_present"],
  D03: ["jwt_auth_routes_and_tokens"],
  D04: ["openai_gpt4omini_integration"],
  D05: ["sse_streaming_enabled"],
  D06: ["pgvector_schema_and_migration"],
  D07: ["sample_data_and_route_tests_present"],
  D08: ["scholar_model_and_import_pipeline_present"],
  D09: ["dashboard_queries_filters_and_tafseer"],
  D10: ["tr_en_language_support_present"],
  D11: ["daily_quota_enforced"],
  D12: ["vitest_supertest_teststack_present"],
  IP01: ["ip01_bilmen_csv_pipeline_evidence"],
  IP02: ["ip02_validation_and_consolidation_scripts"],
  IP03: ["ip03_prompt_system_traceability_rules"],
};

const PDF_REQUIREMENTS: Array<{
  id: string;
  title: string;
  keywords: string[];
  checks: string[];
}> = [
  {
    id: "PDF-01",
    title: "Scholar metadata expansion",
    keywords: ["mufassir_tr", "mufassir_name_long", "tafsir_type1", "detail_information", "book_id"],
    checks: ["scholar_metadata_fields_in_schema"],
  },
  {
    id: "PDF-02",
    title: "Period model enums and codes",
    keywords: ["foundation", "classical_early", "classical_mature", "post_classical", "contemporary"],
    checks: ["scholar_period_enum_values"],
  },
  {
    id: "PDF-03",
    title: "Tradition acceptance tags",
    keywords: ["tradition_acceptance", "sunni_mainstream", "cross_tradition"],
    checks: ["tradition_acceptance_enum_values"],
  },
  {
    id: "PDF-04",
    title: "Source accessibility model",
    keywords: ["source_accessibility", "full_digital", "partial_digital", "manuscript_only", "lost"],
    checks: ["source_accessibility_enum_values"],
  },
  {
    id: "PDF-05",
    title: "Reference entity for citations",
    keywords: ["akademik", "referans", "cilt", "kaynakça"],
    checks: ["scholar_reference_model_and_usage"],
  },
  {
    id: "PDF-06",
    title: "Deterministic derivation from death_hijri and book_id",
    keywords: ["death_hijri", "book_id", "otomatik", "script"],
    checks: ["deterministic_derivation_functions_present"],
  },
  {
    id: "PDF-07",
    title: "Compatibility reputation score retained",
    keywords: ["reputation_score", "ortalama"],
    checks: ["compatibility_reputation_score_computation_present"],
  },
  {
    id: "PDF-08",
    title: "Filters API normalized dimensions",
    keywords: ["period", "madhab", "origin_country"],
    checks: ["filters_api_exposes_normalized_dimensions"],
  },
  {
    id: "PDF-09",
    title: "Tafseer response with confidence and citations",
    keywords: ["güven", "referans", "tefsir"],
    checks: ["tafseer_payload_includes_citations_confidence_stream_and_json"],
  },
  {
    id: "PDF-10",
    title: "Search result persistence for confidence/citations",
    keywords: ["sql", "reputation_score", "column"],
    checks: ["search_result_citations_confidence_schema"],
  },
  {
    id: "PDF-11",
    title: "CI hardening baseline",
    keywords: ["uygulama yol haritası", "adım 1", "script"],
    checks: ["ci_minimal_path_present"],
  },
  {
    id: "PDF-12",
    title: "Managed DB handoff and API readiness baseline",
    keywords: ["uygulamayolharitası", "açıksorular", "kaynakça"],
    checks: ["managed_db_handoff_artifacts_present", "t17_baseline_documented"],
  },
];

function runCheck(checkName: string): void {
  const fn = checks[checkName];
  expect(fn, `Unknown check: ${checkName}`).toBeTypeOf("function");
  if (!fn) {
    throw new Error(`Unknown check: ${checkName}`);
  }
  fn();
}

describe("Traceability - Board Coverage", () => {
  let boardItems: BoardItem[] = [];
  let targetItems: BoardItem[] = [];

  beforeAll(() => {
    boardItems = runPythonJson<BoardItem[]>(BOARD_EXTRACTOR, [BOARD_PATH]);
    targetItems = boardItems.filter((item) => TARGET_BOARD_STATUSES.has(item.status));
  });

  it("covers every DONE / IN PROGRESS board item with at least one check", () => {
    expect(targetItems.length).toBeGreaterThan(0);
    for (const item of targetItems) {
      const checkNames = BOARD_ITEM_CHECKS[item.id];
      expect(checkNames, `Missing check mapping for board item ${item.id}: ${item.task}`).toBeDefined();
      if (!checkNames) {
        continue;
      }
      expect(checkNames.length).toBeGreaterThan(0);
    }
  });

  it("runs mapped checks for each DONE / IN PROGRESS board item", () => {
    for (const item of targetItems) {
      const checkNames = BOARD_ITEM_CHECKS[item.id];
      expect(checkNames, `No checks defined for ${item.id}: ${item.task}`).toBeDefined();
      if (!checkNames) {
        continue;
      }
      for (const checkName of checkNames) {
        runCheck(checkName);
      }
    }
  });
});

describe("Traceability - Claude PDF Coverage", () => {
  let pdfData: PdfExtractResult;
  let normalizedPdf = "";

  beforeAll(() => {
    pdfData = runPythonJson<PdfExtractResult>(PDF_EXTRACTOR, [CLAUDE_PDF_PATH]);
    normalizedPdf = normalizeForMatch(pdfData.fullText);
  });

  it("extracts PDF text content", () => {
    expect(Array.isArray(pdfData.pages)).toBe(true);
    expect(pdfData.pages.length).toBeGreaterThan(0);
    expect(pdfData.fullText.length).toBeGreaterThan(1000);
  });

  PDF_REQUIREMENTS.forEach((req) => {
    it(`${req.id} - ${req.title}`, () => {
      for (const keyword of req.keywords) {
        expect(
          normalizedPdf.includes(normalizeForMatch(keyword)),
          `PDF keyword missing for ${req.id}: ${keyword}`
        ).toBe(true);
      }
      for (const checkName of req.checks) {
        runCheck(checkName);
      }
    });
  });
});
