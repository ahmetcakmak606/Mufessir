# Agent Guidelines for Mufessir

## Project Overview

Mufessir is a monorepo containing:

- `apps/backend` - Express.js API server with Prisma ORM
- `apps/frontend` - Next.js 15 application with React 19 and Tailwind CSS
- `packages/database` - Prisma schema
- `packages/shared-types` - Shared TypeScript types

## Build, Lint, and Test Commands

### Root Commands (Turbo)

```bash
npm run build           # Build all packages
npm run dev             # Run all apps in development
npm run lint            # Lint all packages
npm run test            # Run all tests (frontend + backend)
npm run check-types     # Type-check all packages
npm run format          # Format code with Prettier
```

### Backend Commands

```bash
cd apps/backend
npm run dev             # Start dev server with tsx watch
npm run build           # Compile TypeScript
npm run check-types     # Type-check only
npm run test            # Run all backend tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:traceability # Run specific traceability test
```

### Frontend Commands

```bash
cd apps/frontend
npm run dev             # Start Next.js dev with Turbopack
npm run build           # Build for production
npm run lint            # ESLint check
npm run check-types     # Type-check only
npm run test            # Run all frontend tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:e2e        # Run Playwright e2e tests
npm run test:e2e:headed # Run e2e tests in headed mode
```

### Database Commands

```bash
npm run db:up           # Start Docker containers
npm run db:migrate      # Run Prisma migrations
npm run db:seed         # Seed database with sample data
npm run setup:dev       # Full dev setup (up + migrate + seed)
```

## Code Style Guidelines

### Imports

**Backend:**

- Use explicit relative imports with `.js` extension for ESM: `import router from "./routes/auth.js"`
- Group imports: external libs, then internal modules
- Use type imports where possible: `import { type Request, type Response } from "express"`

**Frontend:**

- Use `@/` alias for absolute imports from `src/`: `import { authApi } from "@/lib/auth"`
- Use client component directive `'use client'` at top of interactive components

### Formatting

- Use Prettier for code formatting (configured in root)
- Run `npm run format` before committing
- 2-space indentation, single quotes for strings, trailing commas

### TypeScript

- Always use explicit types for function parameters and return types
- Use `type` for object shapes, interfaces for extendable types
- Avoid `any`; use `unknown` when type is truly unknown
- Use `as` type assertions only when absolutely necessary

### Naming Conventions

- **Files**: kebab-case for utilities (`scholar-enrichment.ts`), PascalCase for components/classes
- **Functions**: camelCase, verb prefixes (`getUser`, `verifyPassword`)
- **Types/Interfaces**: PascalCase, descriptive (`AuthContextType`)
- **Constants**: SCREAMING_SNAKE_CASE for config values
- **React Components**: PascalCase, descriptive names

### Error Handling

**Backend:**

- Return appropriate HTTP status codes (400, 401, 403, 404, 500)
- Use consistent error response format: `{ error: "Message" }`
- Never expose internal error details to clients
- Log errors server-side with `console.error`
- Use try/catch in route handlers, return 500 on exceptions

**Frontend:**

- Use React Query's error states for API errors
- Display user-friendly error messages
- Handle loading states appropriately

### Express Routes

- Use async/await for all route handlers
- Validate request body early, return 400 for missing fields
- Use middleware for auth (`authenticateJWT`) and quota enforcement
- Mount routers at `/routes/*` paths

### React Patterns

- Use functional components with TypeScript
- Use `useAuth` hook for authentication context
- Use React Query (`@tanstack/react-query`) for server state
- Use `useState` for local UI state
- Extract reusable logic into custom hooks

### Testing

**Framework**: Vitest for both backend and frontend

**Backend Tests:**

- Use `supertest` for HTTP integration tests
- Mock external services and database operations where needed
- Use `describe` blocks to group related tests
- Test both success and error cases

**Frontend Tests:**

- Use `@testing-library/react` for component tests
- Use `@testing-library/user-event` for user interactions
- Test rendering and user interactions, not implementation details

**Running Single Tests:**

```bash
# Backend - run specific test file
cd apps/backend && npx vitest run tests/app.test.ts

# Backend - run specific test by name
cd apps/backend && npx vitest run --testNamePattern "Health"

# Frontend - run specific test file
cd apps/frontend && npx vitest run src/components/dashboard/RunActions.test.tsx

# Frontend - run specific test by name
cd apps/frontend && npx vitest run --testNamePattern "disables save"
```

### Database (Prisma)

- Use Prisma Client for all database operations
- Schema is in `packages/database/prisma/schema.prisma`
- Generate client after schema changes: `npx prisma generate --schema ...`
- Use Prisma's type-safe queries

### Environment Variables

- Required env vars documented in `.env.example` (create if missing)
- Never commit `.env` files
- Use `process.env.VAR_NAME` with type assertion: `process.env.JWT_SECRET as string`

---

## Active Work: Rearchitecture

**Location:** `docs/REARCHITECTURE_PLAN.md`

### Current Status

```
Version: v1.1.0 → v1.2.0
Phase: 1 (Snapshot System) - IN PROGRESS
Next: Update tafsir route to record snapshots on each query
```

### Quick Resume

If continuing this work:

1. Read `docs/REARCHITECTURE_PLAN.md`
2. Find first unchecked `[ ]` in current phase
3. Follow step-by-step instructions
4. Run tests before commit
5. Update plan marking `[ ]` → `[x]`

### What's Being Built

1. **Snapshot System** - Academic reproducibility with citation keys
2. **Filter Redesign** - Replace broken sliders with methodology tags
3. **Method Tags** - Multi-dimensional filtering

### Key Context

- **Problem:** tone/intellect sliders don't affect retrieval (only prompt)
- **Fix:** methodTags filter at DB level
- **Also:** AcademicSnapshot for citation keys

### Pre-commit Checklist

```bash
npm run lint
npm run check-types
npm run test
```

### Version Control (For Reference)

- Commit format: `feat(<scope>): <description>`
- Tag releases: `git tag -a v1.2.0 -m "Release v1.2.0"`
- Push: `git push && git push --tags`
