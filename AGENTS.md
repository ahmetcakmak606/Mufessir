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

### Root (run from monorepo root)

| Command               | Description                |
| --------------------- | -------------------------- |
| `npm run dev`         | Start all apps in dev mode |
| `npm run build`       | Build all packages         |
| `npm run test`        | Run all tests              |
| `npm run lint`        | Lint all packages          |
| `npm run check-types` | Type-check all packages    |
| `npm run format`      | Format with Prettier       |

### Backend (`cd apps/backend`)

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `npm run dev`           | Start dev server (tsx watch) |
| `npm run build`         | Build with TypeScript        |
| `npm run check-types`   | Type-check only              |
| `npm run test`          | Run tests                    |
| `npm run test:watch`    | Watch mode                   |
| `npm run test:coverage` | With coverage                |

### Frontend (`cd apps/frontend`)

| Command               | Description               |
| --------------------- | ------------------------- |
| `npm run dev`         | Start Next.js (Turbopack) |
| `npm run build`       | Build production          |
| `npm run lint`        | Run ESLint                |
| `npm run check-types` | Type-check only           |
| `npm run test`        | Run tests                 |
| `npm run test:watch`  | Watch mode                |
| `npm run test:e2e`    | Playwright e2e tests      |

### Database

```bash
npm run db:up        # Start Docker
npm run db:migrate   # Run Prisma migrations
npm run db:seed     # Seed sample data
npm run setup:dev   # Full: up + migrate + seed
```

### Running Single Tests

```bash
# Backend - specific file
cd apps/backend && npx vitest run tests/app.test.ts

# Backend - by test name pattern
cd apps/backend && npx vitest run --testNamePattern "Health"

# Frontend - specific file
cd apps/frontend && npx vitest run src/components/Some.test.tsx

# Frontend - by test name pattern
cd apps/frontend && npx vitest run --testNamePattern "disables save"

# E2E - headed for debugging
cd apps/frontend && npm run test:e2e:headed
```

---

## Code Style

### Imports

**Backend:** Explicit relative imports with `.js` extension

```ts
import router from "./routes/auth.js";
import { type Request, type Response } from "express";
import { db } from "../lib/db.js";
```

**Frontend:** Use `@/` alias from `src/`

```ts
import { authApi } from "@/lib/auth";
import { UserCard } from "@/components/UserCard";
```

Add `'use client'` at top of client-side interactive components.

### Formatting

- Run `npm run format` before committing
- 2-space indent, single quotes, trailing commas
- Configured in root prettier settings

### TypeScript

- Explicit types for function params and returns
- Use `type` for shapes, `interface` for extendable types
- Avoid `any`; use `unknown` if needed
- Use `as` assertions sparingly, prefer type guards

### Naming Conventions

| Type               | Convention       | Example                     |
| ------------------ | ---------------- | --------------------------- |
| Files (utils)      | kebab-case       | `scholar-enrichment.ts`     |
| Files (components) | PascalCase       | `UserCard.tsx`              |
| Files (hooks)      | PascalCase       | `useAuth.ts`                |
| Functions          | camelCase + verb | `getUser`, `verifyPassword` |
| Types              | PascalCase       | `AuthContextType`           |
| Constants          | SCREAMING_SNAKE  | `MAX_REQUESTS`              |
| React components   | PascalCase       | `UserProfile`               |

---

## Error Handling

### Backend

- HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)
- Response format: `{ error: "User-friendly message" }`
- Never expose internal error details to clients
- Use try/catch, return 500 on uncaught exceptions
- Validate request body early; return 400 for missing required fields

### Frontend

- Use React Query for server state with built-in error states
- Display user-friendly error messages
- Always handle loading states during data fetches
- Show inline validation errors on forms

---

## Patterns

### Express Routes

```ts
// All handlers use async/await
router.post("/route", authenticateJWT, async (req, res) => {
  try {
    const { field } = req.body;
    if (!field) {
      return res.status(400).json({ error: "field is required" });
    }
    // ... handler logic
  } catch (error) {
    console.error("Route error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

- Use auth middleware (`authenticateJWT`) for protected routes
- Mount routers at `/routes/*`
- Validate body early → 400 for missing fields

### React Components

- Use functional components with TypeScript
- Use `useAuth` hook for authentication context
- Use React Query (`@tanstack/react-query`) for server state
- Use `useState` for local component state
- Extract reusable logic to custom hooks

### Testing

- Vitest for both frontend and backend
- Backend: supertest for HTTP integration tests
- Frontend: @testing-library/react + user-event for component tests

---

## Pre-commit Checklist

```bash
npm run lint && npm run check-types && npm run test
```

---

## Environment Variables

Create `.env` files from `.env.example`. Required variables:

```
# Backend
DATABASE_URL
JWT_SECRET
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```
