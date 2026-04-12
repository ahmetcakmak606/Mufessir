# Agent Guidelines for Mufessir

Quick reference for agentic coding in this monorepo.

## Project Structure

```
apps/backend       - Express.js API server with Prisma ORM
apps/frontend      - Next.js 15 + React 19 + Tailwind CSS
packages/database  - Prisma schema
packages/shared-types - Shared TypeScript types
```

---

## Commands

### Run Everything

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `npm run dev`         | Start all apps in dev mode   |
| `npm run build`       | Build all packages           |
| `npm run test`        | Run frontend + backend tests |
| `npm run lint`        | Lint all packages            |
| `npm run check-types` | Type-check all packages      |

### Backend (`cd apps/backend`)

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `npm run dev`           | Start dev server (tsx watch) |
| `npm run test`          | Run tests                    |
| `npm run test:watch`    | Watch mode                   |
| `npm run test:coverage` | With coverage                |

### Frontend (`cd apps/frontend`)

| Command              | Description               |
| -------------------- | ------------------------- |
| `npm run dev`        | Start Next.js (Turbopack) |
| `npm run test`       | Run tests                 |
| `npm run test:watch` | Watch mode                |
| `npm run test:e2e`   | Playwright e2e tests      |

### Database

```bash
npm run db:up        # Start Docker
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed sample data
npm run setup:dev   # Full: up + migrate + seed
```

### Running Single Tests

```bash
# Backend - specific file
cd apps/backend && npx vitest run tests/app.test.ts

# Backend - by test name
cd apps/backend && npx vitest run --testNamePattern "Health"

# Frontend - specific file
cd apps/frontend && npx vitest run src/components/Some.test.tsx

# Frontend - by test name
cd apps/frontend && npx vitest run --testNamePattern "disables save"
```

---

## Code Style

### Imports

**Backend:** Explicit relative with `.js` extension

```ts
import router from "./routes/auth.js";
import { type Request, type Response } from "express";
```

**Frontend:** Use `@/` alias from `src/`

```ts
import { authApi } from "@/lib/auth";
```

Add `'use client'` at top of interactive components.

### Formatting

- Prettier: `npm run format` before commit
- 2-space indent, single quotes, trailing commas

### TypeScript

- Explicit types for params/returns
- `type` for shapes, `interface` for extendable types
- Avoid `any`; use `unknown` if needed
- Use `as` assertions sparingly

### Naming

| Type               | Convention       | Example                     |
| ------------------ | ---------------- | --------------------------- |
| Files (utils)      | kebab-case       | `scholar-enrichment.ts`     |
| Files (components) | PascalCase       | `UserCard.tsx`              |
| Functions          | camelCase + verb | `getUser`, `verifyPassword` |
| Types              | PascalCase       | `AuthContextType`           |
| Constants          | SCREAMING_SNAKE  | `MAX_REQUESTS`              |

---

## Error Handling

**Backend:**

- HTTP status codes: 400, 401, 403, 404, 500
- Response format: `{ error: "Message" }`
- Never expose internal details to clients
- Use try/catch, return 500 on exceptions

**Frontend:**

- React Query error states
- User-friendly messages
- Handle loading states

---

## Patterns

### Express Routes

- async/await for all handlers
- Validate body early → 400 for missing fields
- Use auth middleware (`authenticateJWT`)
- Mount at `/routes/*`

### React

- Functional components + TypeScript
- `useAuth` hook for auth context
- React Query for server state
- `useState` for local state
- Extract reusable logic to custom hooks

### Testing

- Vitest for both
- Backend: supertest for HTTP integration
- Frontend: @testing-library/react + user-event

---

## Pre-commit Checklist

```bash
npm run lint && npm run check-types && npm run test
```

---

## Active Work

**Location:** `docs/REARCHITECTURE_PLAN.md`

**Current:** Snapshot System for academic reproducibility with citation keys.

**To resume:**

1. Read the plan, find first unchecked `[ ]`
2. Follow steps, run tests
3. Mark `[ ]` → `[x]`
