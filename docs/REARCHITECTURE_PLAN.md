# MufessirAI Rearchitecture Plan

**Status:** In Progress  
**Current Version:** v1.1.0  
**Target Version:** v1.2.0  
**Created:** 2026-04-11  
**Last Updated:** 2026-04-11

---

## Quick Resume (For Next Agent)

```
If you are picking up this work:
1. Read docs/REARCHITECTURE_PLAN.md
2. Find first unchecked [ ] in current phase
3. Read the step-by-step section for that deliverable
4. Run pre-commit checks before committing
5. Update this plan when done: change [ ] to [x]
```

**Done so far:**

- Planning complete
- CI enhanced with commit validation

**Next deliverable:** Phase 1, Item 1 - Add AcademicSnapshot model

**In this session:**

- Created AGENTS.md with rearchitecture context
- Starting Phase 1 implementation

**Current phase:** 1

---

## Version History

| Version | Date       | Hosting                       | Changes                           |
| ------- | ---------- | ----------------------------- | --------------------------------- |
| v1.1.0  | 2026-04-11 | Railway + Vercel + PostgreSQL | Current production state          |
| v1.2.0  | (planned)  | same                          | Filter redesign + Snapshot system |

---

## Executive Summary

This document outlines the rearchitecture of MufessirAI to address three critical structural issues:

1. **Filter Model Redesign** - Replace 1-10 slider with multi-dimensional methodology selector
2. **Snapshot System** - Full academic reproducibility with immutable analysis records
3. **Metadata Tags** - Interim solution for multi-dimensional indexing

---

## 1. Filter Model Redesign

### 1.1 Problem Statement (VERIFIED)

**Current behavior:**

1. User sets `tone: 7, intellectLevel: 7` in UI → sent to API
2. These values go ONLY to the prompt (LLM writing style)
3. **Retrieval ignores them entirely** - uses pure semantic vector search
4. `languageLevel` and `emotionalRatio` columns exist in schema but are NEVER populated or queried

**Evidence from code:**

- `performSimilaritySearch` only filters by: `verseId`, `scholarIds`, `excludeScholarIds`
- No code queries `languageLevel` or `emotionalRatio`

**Impact:** Users think filters work, but they don't. False sense of control.

### 1.2 Proposed Solution: Multi-Dimensional Methodology Selector

Replace slider with independent dimensions based on classical tafsir usul:

| Dimension             | Pole A                | Pole B                   | Example Scholars      |
| --------------------- | --------------------- | ------------------------ | --------------------- |
| **Source Basis**      | Rivayet (hadis-based) | Dirayet (analysis-based) | Taberî ↔ Râzî        |
| **Linguistic Focus**  | Lugavî/Belâğat        | Tematik/Hikemî           | Zemahşerî ↔ İbn Âşûr |
| **Interpretive Mode** | Zâhir (literal)       | İşârî (inner)            | İbn Kesîr ↔ Kuşeyrî  |
| **Legal Focus**       | Ahkâm (fiqh)          | Akâid (theology)         | Kurtubî ↔ Mâtürîdî   |

### 1.3 Database Changes

**Remove from schema:**

- `Tafsir.languageLevel` (Int) - never used
- `Tafsir.emotionalRatio` (Float) - never used
- ALSO: Remove tone/intellectLevel from PROMPT (currently affects LLM writing style only)

**Add to schema:**

```prisma
model Tafsir {
  // ... existing fields
  methodTags String[]  // e.g., ["RIVAYET", "LUUGAVI", "ZAHIR", "AHKAM"]
}
```

### 1.4 Tag Derivation Logic

Tags derived from `Scholar.tafsirType1` and `Scholar.tafsirType2`:

```
tafsirType1/2 → methodTags mapping:
- "Rivayet"      → ["RIVAYET"]
- "Dirayet"      → ["DIRAYET"]
- "Lugavi"       → ["LUUGAVI"]
- "Isari"        → ["ISARI"]
- "Belaghat"     → ["LUUGAVI"]
- "Tematik"      → ["TEMATIK"]
- "Hkmt" (Ahkam) → ["AHKAM"]
```

If tafsirType is null on scholar, default to `["MIXED"]`

### 1.4 Migration Steps

1. Add `methodTags` column to Tafsir table
2. Populate with initial mappings based on scholar profiles:
   - Taberî: `["RIVAYET", "LUUGAVI", "ZAHIR"]`
   - Râzî: `["DIRAYET", "TEMATIK", "AKAID"]`
   - Zemahşerî: `["DIRAYET", "LUUGAVI"]`
   - İbn Kesîr: `["RIVAYET", "ZAHIR", "AHKAM"]`
   - Kuşeyrî: `["ISARI"]`
   - Kurtubî: `["DIRAYET", "AHKAM"]`
3. Update backend similarity search to filter by `methodTags`
4. Replace UI slider with toggle panel
5. Remove unused `tone` and `intellectLevel` from API filters

---

## 2. Snapshot System (Full Implementation)

### 2.1 Problem Statement

No reproducibility - same query produces different results over time:

- Database updates
- Embedding refreshes
- Prompt changes
- Model versions

Cannot cite MufessirAI in academic work.

### 2.2 Proposed Solution: AcademicSnapshot Model

```prisma
model AcademicSnapshot {
  id              String   @id @default(cuid())
  snapshotId      String   @unique  // Stable citation ID: "MufessirAI-v1.2-2026-04-11-abc123"

  // Query Input
  verseId         String
  queryText       String

  // System State at Query Time
  corpusVersion   String   // DB snapshot version
  embeddingModel String   // "text-embedding-3-small"
  llmModel       String   // "gpt-4o"
  promptHash     String   // Hash of prompt template

  // Response Output
  aiResponse     String   @db.Text
  arabicTafsir   String?  @db.Text
  turkishTafsir  String?  @db.Text

  // Sources Retrieved
  retrievedSources Json    // Full source list with scores

  // Metadata
  confidence     Float?
  provenance    String?
  citations     Json?

  // Timestamps
  generatedAt    DateTime @default(now())

  // Citation
  citationKey    String   // "MufessirAI, v1.2, 2026-04-11, #abc123"

  search         Search?  @relation(fields: [searchId], references: [id])
  searchId      String?
}
```

### 2.3 Implementation Order

1. Create AcademicSnapshot model in schema
2. Add migration for new table
3. Update tafsir route to create snapshot on each query
4. Generate stable `citationKey` for each analysis
5. Expose snapshot in API response
6. Create `/snapshots/:id` endpoint for retrieval

### 2.4 Citation Key Format

```
MufessirAI, v{version}, {YYYY-MM-DD}, #{shortHash}
```

Example: `MufessirAI, v1.2, 2026-04-11, #k7x2m`

Users can cite like:

> "According to MufessirAI, v1.2, 2026-04-11, #k7x2m..."

---

## 3. Metadata Tags (Interim Solution)

### 3.1 Problem Statement

Single embedding loses multiple aspects of tafsir passage:

- Linguistic analysis
- Fıkhî extraction
- Kelâmî discussion
- İşârî dimension

### 3.2 Proposed Solution: Tag-Based Filtering

Instead of multi-vector embeddings (expensive), use methodTags for initial filtering:

```prisma
// Filtering flow:
// 1. User selects methodology dimensions
// 2. backend converts to methodTags array
// 3. similarity search includes WHERE clause for methodTags
// 4. Results filtered before ranking
```

### 3.3 Tag Set

```
RIVAYET     // Hadis-rivayet based
DIRAYET     // Analytical reasoning
LUUGAVI     // Linguistic/blahagah focused
TEMATIK     // Thematic/hikma focused
ZAHIR       // Literal exegesis
ISARI       // Sufi/batini interpretation
AHKAM       // Legal/fiqh focus
AKAID       // Theological focus
```

### 3.4 Implementation

1. Add migration: `ALTER TABLE "Tafsir" ADD COLUMN "methodTags" TEXT[]`
2. Populate with scholar-based defaults
3. Update `performSimilaritySearch` to accept methodTags filter
4. Update tafsir endpoint to pass methodTags to search
5. Frontend: Replace slider with toggle panel

---

## 4. Implementation Order

---

# Implementation Guide (Agent-Friendly)

Each phase is independent. Skip ahead when complete, but do phases in order.

## Context for Next Agent

**Current state:**

- Last completed: Planning (v1.1.0)
- Next target: Phase 1 complete → v1.2.0
- Production runs on Railway + Vercel

**Key files to know:**

- Schema: `packages/database/prisma/schema.prisma`
- Backend route: `apps/backend/src/routes/tafseer.ts`
- Similarity search: `apps/backend/src/utils/similarity-search.ts`
- Frontend query: `apps/frontend/src/app/dashboard/query/page.tsx`

---

## Phase 1: Snapshot System (Priority: HIGH)

**Goal:** Academic reproducibility - each query gets a permanent citation key

**Deliverables:**

1. [x] Add AcademicSnapshot model to schema (schema.prisma)
2. [x] Create migration: `npx prisma migrate dev --name add_academic_snapshot`
3. [x] Update backend route to record snapshots on each query
4. [x] Generate stable citationKey format: `MufessirAI, v{version}, {YYYY-MM-DD}, #{hash}`
5. [x] Expose in API response
6. [x] Create `/snapshots/:id` endpoint for retrieval
7. [x] Update frontend to show citation key on result

**Note:** Database pushed directly - Railway doesn't have pgvector extension, embedding removed temporarily

**Step-by-step:**

1. **Add model to schema.prisma:**

   ```prisma
   model AcademicSnapshot {
     id            String   @id @default(cuid())
     snapshotId    String   @unique
     verseId       String
     queryText     String
     corpusVersion String
     embeddingModel String
     llmModel      String
     promptHash    String
     aiResponse    String   @db.Text
     arabicTafsir  String?  @db.Text
     turkishTafsir String?  @db.Text
     retrievedSources Json
     confidence    Float?
     provenance   String?
     citations    Json?
     generatedAt   DateTime @default(now())
     citationKey  String
     searchId     String?
   }
   ```

2. **Create migration:**

   ```bash
   cd packages/database
   npx prisma migrate dev --name add_academic_snapshot
   # Follow prompts, name can be anything
   ```

3. **Update tafsir route** (`apps/backend/src/routes/tafseer.ts`):

   - Import AcademicSnapshot
   - After generating AI response, create snapshot record
   - Generate citationKey using date + short hash

4. **Test flow:**

   - Build backend: `npm run build:backend`
   - Start: `npm run dev:backend`
   - Make query, verify citationKey in response

5. **Frontend update:**
   - Add citationKey display to result panel
   - Add copy button

---

## Phase 2: Filter Redesign - Backend (Priority: HIGH)

**Goal:** Remove broken tone/intellect filters, add methodTags filtering

**Deliverables:**

1. [x] Add methodTags to Tafsir model (schema.prisma)
2. [x] Create migration: `npx prisma migrate dev --name add_method_tags`
3. [x] Populate methodTags from scholar.tafsirType1/2 (seed script or manual)
4. [x] Update similarity search to accept methodTags filter
5. [x] Remove tone/intellect from PROMPT (prompt.ts)
6. [x] Remove tone/intellect from API (tafseer.ts route)

**Rollback path:** Keep old data, new features added alongside

**Step-by-step:**

1. **Add methodTags to schema:**

   ```prisma
   model Tafsir {
     // ... existing
     methodTags String[] @default(["MIXED"])
   }
   ```

2. **Create migration:**

   ```bash
   npx prisma migrate dev --name add_method_tags
   ```

3. **Populate from scholar.tafsirType1/2:**

   - Write seed/update script that maps:
     - "Rivayet" → ["RIVAYET"]
     - "Dirayet" → ["DIRAYET"]
     - "Isari" → ["ISARI"]
     - null → ["MIXED"]
   - Run for all existing tafsirs

4. **Update similarity search** (`apps/backend/src/utils/similarity-search.ts`):

   - Add `methodTags?: string[]` to SimilaritySearchOptions
   - Add WHERE clause: `AND t."methodTags" && $tags`

5. **Remove from prompt** (`apps/backend/src/utils/prompt.ts`):

   - Remove tone/intellectLevel parameters
   - Remove prompt instructions referencing them

6. **Remove from API** (`apps/backend/src/routes/tafseer.ts`):
   - Remove tone/intellectLevel from filters interface
   - Don't pass to prompt

---

## Phase 3: Filter Redesign - Frontend (Priority: HIGH)

**Goal:** Replace slider with methodology toggle panel

**Deliverables:**

1. [ ] Remove tone/intellect sliders (QueryComposer.tsx)
2. [ ] Create new methodology toggle panel
3. [ ] Update API call to use methodTags instead of tone
4. [ ] Update locales (remove old slider labels)
5. [ ] Test: select Rivayet, verify only Rivayet scholars returned

---

### Phase 4: Schema Cleanup (Priority: LOW)

**Goal:** Remove unused fields

**Deliverables:**

1. [ ] Remove languageLevel, emotionalRatio from Tafsir model
2. [ ] Create migration: `npx prisma migrate dev --name remove_unused_tafsir_fields`
3. [ ] Run tests, verify nothing broke

---

### Phase 5: Data Verification (Priority: MEDIUM)

**Goal:** Verify data in production is correct

**Deliverables:**

1. [ ] Check methodTags populated correctly
2. [ ] Verify no null/empty tags
3. [ ] Test search with methodTags filter

### Phase 4: Future Considerations (Out of Scope)

- Arabic-specific embedding model
- Multi-vector indexing
- Real-time model versioning

---

## 5. Breaking Changes Summary

| Change                     | Breaking? | Migration Path                            |
| -------------------------- | --------- | ----------------------------------------- |
| Remove tone/intellectLevel | YES       | Log saved queries, no automatic migration |
| Add methodTags             | NO        | Backfill with defaults                    |
| Add AcademicSnapshot       | NO        | New table, optional backfill              |

---

## 6. Version Control & Release Process

### 6.1 Semantic Versioning

Format: `v{major}.{minor}.{patch}`

| Increment         | When                                            |
| ----------------- | ----------------------------------------------- |
| **major** (x.0.0) | Breaking changes - schema changes, removed APIs |
| **minor** (1.x.0) | New features - methodTags, AcademicSnapshot     |
| **patch** (1.2.x) | Bug fixes - no schema changes                   |

### 6.2 Commit Message Format

```
# Format: <type>(<scope>): <description>

Types:
- feat:     New feature
- fix:      Bug fix
- refactor: Code change without new feature
- docs:     Documentation
- chore:    Build, deps, CI

Examples:
feat(schema): add methodTags to Tafsir model
fix(backend): remove tone from prompt generation
refactor(db): derive tags from scholar.tafsirType
docs(plan): update rearchitecture plan
```

### 6.3 CI Pipeline (GitHub Actions)

Runs on every push to main and all PRs:

```
Stage 1: Quality Gates (must pass)
- Lint           → npm run lint
- Type-check     → npm run check-types
- Tests          → npm run test
- Coverage      → 70% minimum on changed files

Stage 2: Integration
- Database migrations applied
- E2E tests (Playwright)

Stage 3: Production Readiness
- Build all apps
- Smoke test (Postman)
```

**Job names follow:**

- `feat(upload):` - uploads to production
- `fix(auth):` - hotfix to production

### 6.6 Pre-commit Checklist (AI responsibility)

Before committing, verify:

```
□ Changes align with current plan/reasoning
□ Tests pass: npm run test
□ Typecheck passes: npm run check-types
□ Lint passes: npm run lint
□ Build succeeds: npm run build
□ Schema migrations tested locally (if applied)
□ No secrets or .env accidentally staged
□ Commit message follows convention
```

**Important:** Never skip pre-commit checks to speed up. If something is failing, fix it properly.

### 6.3 Release Checklist

Before each release:

- [ ] Run tests: `npm run test`
- [ ] Run typecheck: `npm run check-types`
- [ ] Run lint: `npm run lint`
- [ ] Build: `npm run build`
- [ ] Test db migration locally
- [ ] Tag with version: `git tag -a v1.2.0 -m "Release v1.2.0"`
- [ ] Push with tags: `git push && git push --tags`

### 6.4 Developer Workflow (AI-assisted commits)

When AI makes commits on your behalf:

```
# Before each commit (AI does these):

1. Review all changes:    git status && git diff
2. Verify tests pass:  npm run test && npm run lint && npm run check-types
3. If schema change:   npx prisma migrate dev --name <descriptive_name>
4. Check migrated data works locally

# Commit command format:

AI runs: git commit -m "<type>(<scope>): <description>"

Examples for Mufessir:
- feat(schema): add methodTags to Tafsir model
- fix(tafseer): remove tone from prompt generation
- refactor(similarity): add methodTags filter to search
- docs(api): document new snapshot endpoints
- chore(ci): add commit message validation
```

**Tagging commands:**

```
# Version bump (done after tested changes on main)
git tag -a v1.2.0 -m "Release v1.2.0: methodology selector + snapshots"

# Push to trigger production
git push && git push --tags
```

# Common commands reference

# View current version

git describe --tags --abbrev=0

# Create a patch release

git tag -a v1.1.1 -m "Patch v1.1.1"
git push origin v1.1.1

# Create a minor release

git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

```

### 6.5 Database Migration Strategy

```

Development:

1. Make schema change in prisma/schema.prisma
2. Run: npx prisma migrate dev --name <migration_name>
3. Test locally
4. Commit schema + migration files

Production:

1. Deploy code
2. Run: npx prisma migrate deploy
3. Verify in prod

```

---

## 7. Questions for Future Discussion

1. **Tag completeness**: Are 8 tags sufficient? Should we add sub-tags?
2. **Scholar mapping**: Who validates initial methodTags mappings?
3. **Citation versioning**: How to handle future schema changes?
4. **Backfill strategy**: Full migration or incremental?

---

## 8. Related Documents

- `docs/input.md` - Original problem analysis
- `docs/TDD_WORKFLOW.md` - Testing approach
- `packages/database/prisma/schema.prisma` - Current schema
- `MufessirAI_Metadata_Framework.md` - Reputation model context
```
