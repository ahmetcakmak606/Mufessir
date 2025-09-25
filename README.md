# Mufessir – AI-powered Tafsir Platform

Guiding principle: The AI must rely solely on controlled data from our DB. No internet search; the backend assembles complete, verifiable context before each AI call.

## Repository Overview

- Monorepo (Turborepo) with:
  - `apps/frontend` – Next.js 15 (React 19), Tailwind v4, App Router, SSE streaming UI
  - `apps/backend` – Express, Prisma (Postgres + pgvector), JWT auth, SSE streaming endpoint, caching, similarity search
  - `packages/database` – Prisma schema + migrations (pgvector), embedding script
  - `packages/eslint-config`, `packages/typescript-config`, `packages/shared-types`

### Backend Capabilities
- Routes: `/auth` (register/login/me/password reset), `/tafseer` (stream/non-stream with caching), `/filters`, `/verses`, `/health`
- Auth & quota: JWT-based, daily quota with auto-reset window
- Similarity: pgvector search (with sample mode fallback), post-generation similarity scoring
- OpenAI: streaming and non-streaming completions (toggle via env), robust fallback when disabled

### Frontend Capabilities
- Auth flow (register/login/logout), language toggle (TR/EN)
- Dashboard with verse picker, scholar filters, tone/intellect controls, SSE streaming result
- Uses `NEXT_PUBLIC_API_URL` to reach backend (defaults to `http://localhost:4000` in dev)

## Quick Start (Local)

1) Copy environment variables

```
cp .env.example .env
```

2) Start database (pgvector)

```
npm run db:up
```

3) Run migrations and seed sample data

```
npm run db:migrate
npm run db:seed
```

4) Start apps (in split terminals)

```
# Backend
cd apps/backend && npm i && npm run dev

# Frontend
cd apps/frontend && npm i && npm run dev
```

Open http://localhost:3000 and register/login, then use the dashboard to stream tafsir.

Notes
- Frontend falls back to `http://localhost:4000` if `NEXT_PUBLIC_API_URL` is not set.
- OpenAI is optional in development; when disabled the backend serves an informative fallback.

## Environment Variables

Backend (.env at repo root is loaded by the backend):
- `DATABASE_URL` – Postgres connection string
- `SHADOW_DB_URL` – Prisma shadow DB URL
- `JWT_SECRET` – Secret for JWT signing
- `FREE_DAILY_QUOTA` – Per-user daily quota (default 10)
- `OPENAI_API_KEY` – OpenAI API key (optional in dev)
- `AI_MODE` – `on` | `off` (off disables OpenAI)
- `OPENAI_DISABLED` – `1` to disable OpenAI regardless of key
- `SIMILARITY_MODE` – `sample` to skip embeddings and return sample similarities
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` – outbound email (password reset); omitted uses console output
- `APP_URL` – Frontend URL for reset links (default http://localhost:3000)

Frontend (build-time):
- `NEXT_PUBLIC_API_URL` – Backend base URL (set via Vercel or `.env.local` in `apps/frontend`)

## Testing

Backend tests use Vitest + Supertest. Ensure DB is migrated and sample data is present:

```
cd apps/backend
npm i
npm run seed
npm run test
```

## Roadmap (Excerpt)
- CI: lint → type-check → test → migrate → deploy
- Observability: structured logging and basic tracing
- Cost controls: rate limiting and caching refinements
