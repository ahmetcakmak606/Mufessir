# Agent Guidelines for Mufessir

Quick reference for agentic coding in this monorepo.

## Project Structure

```
apps/backend       - Express.js API server with Prisma ORM
apps/frontend     - Next.js 15 + React 19 + Tailwind CSS
packages/database - Prisma schema
packages/shared-types - Shared TypeScript types
```

---

## Commands

### Root

| Command               | Description          |
| --------------------- | -------------------- |
| `npm run dev`         | Start all apps       |
| `npm run build`       | Build all packages   |
| `npm run test`        | Run all tests        |
| `npm run lint`        | Lint all packages    |
| `npm run check-types` | Type-check all       |
| `npm run format`      | Format with Prettier |

### Database

```bash
npm run db:up        # Start Docker (pgvector)
npm run db:migrate   # Prisma migrations
npm run db:seed     # Seed sample data
npm run setup:dev   # Full: up + migrate + seed
```

### Single Tests

```bash
# Backend by file or pattern
cd apps/backend && npx vitest run tests/app.test.ts
cd apps/backend && npx vitest run --testNamePattern "Health"

# Frontend by file or pattern
cd apps/frontend && npx vitest run src/components/Some.test.tsx

# E2E headed
cd apps/frontend && npm run test:e2e:headed
```

---

## Critical Setup

- **`.env` goes at repo root** (not in apps/). Copy from `.env.example`.
- Required: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL=http://localhost:4000`
- Backend is ES module (`"type": "module"` in package.json)

---

## Code Style

- Backend imports: explicit relative with `.js` extension
- Frontend: `@/` alias from `src/`
- Add `'use client'` to interactive components

---

## CI Order (important)

```
lint → typecheck → test → coverage → e2e → Postman smoke
```

Pre-commit: `npm run lint && npm run check-types && npm run test`

---

## Non-obvious Commands

```bash
npm run quality:scholars      # Scholar data quality check
npm run db:enrich:scholars   # Import CSV enrichments
npm run db:export:scholar-starter  # Export template
npm run db:derive           # Derive metadata from embeddings
npm run import-sqlite       # Import from SQLite
npm run import-mysql-dump   # Import from MySQL dump
```

---

## Commit Convention

Conventional Commits: `<type>(<scope>): <description>`

- Types: feat, fix, refactor, docs, chore
