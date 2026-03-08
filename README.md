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
- Citable core: `/tafseer` returns `confidence`, `provenance`, and `citations[]` metadata
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
npm run db:derive
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
- `GOOGLE_CLIENT_ID` – Google OAuth client ID for SSO token audience validation
- `GOOGLE_CLIENT_IDS` – Optional comma-separated list of allowed Google client IDs
- `APPLE_CLIENT_ID` – Apple Services ID (client ID) for Apple SSO audience validation
- `APPLE_CLIENT_IDS` – Optional comma-separated list of allowed Apple client IDs
- `OPENAI_API_KEY` – OpenAI API key (optional in dev)
- `AI_MODE` – `on` | `off` (off disables OpenAI)
- `OPENAI_DISABLED` – `1` to disable OpenAI regardless of key
- `SIMILARITY_MODE` – `sample` to skip embeddings and return sample similarities
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` – outbound email (password reset); omitted uses console output
- `APP_URL` – Frontend URL for reset links (default http://localhost:3000)

Frontend (build-time):
- `NEXT_PUBLIC_API_URL` – Backend base URL (set via Vercel or `.env.local` in `apps/frontend`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` – Google OAuth client ID used by Google Identity Services on login/register
- `NEXT_PUBLIC_APPLE_CLIENT_ID` – Apple Services ID used by Apple JS sign-in on login/register
- `NEXT_PUBLIC_APPLE_REDIRECT_URI` – Optional Apple redirect URI (defaults to current origin)

## Testing

Backend tests use Vitest + Supertest. Ensure DB is migrated and sample data is present:

```
cd apps/backend
npm i
npm run seed
npm run test
```

Workspace test commands:

```
npm run test
npm run test:coverage
npm run test:e2e:frontend
```

For E2E on a new machine, install Playwright Chromium once:

```
npm exec --workspace apps/frontend playwright install chromium
```

Run only the mobile E2E project when needed:

```
npm --workspace apps/frontend run test:e2e -- --project=chromium-mobile
npm --workspace apps/frontend run test:e2e -- --project=chromium-iphone-mobile
```

Run Postman/Newman backend smoke tests (API gate before frontend):

```
# terminal 1
cd apps/backend
npm run build && npm run start

# terminal 2
npx --yes newman run apps/backend/postman_collection.json --env-var baseUrl=http://127.0.0.1:4000 --bail
```

CI runs this Newman smoke suite on every push/PR.

### Postman Backend Smoke Suite

Import one of these collections into Postman:
- `apps/backend/postman_collection.json` (canonical backend location)
- `apps/frontend/postman_collection.json` (same content, kept for convenience)

Then run the full collection in order (Collection Runner). It covers:
- `/health`
- `/auth` (`register`, `login`, `me`, password reset request/confirm)
- `/filters`
- `/verses` (by numbers, list, search)
- `/tafseer` (unauthorized, non-streaming, streaming SSE)

The suite auto-chains variables (`token`, `verseId`) and asserts response shape/status so you can validate backend readiness before frontend integration.

### SSO (Google + Apple)

- Backend endpoint: `POST /auth/sso/google` with body `{ "idToken": "<google-id-token>" }`
- Backend endpoint: `POST /auth/sso/apple` with body `{ "idToken": "<apple-id-token>", "name": "Optional Name" }`
- Login/Register pages include a `Continue with Google` action.
- Login/Register pages include a `Continue with Apple` action.
- Apple SSO buttons are hidden unless `NEXT_PUBLIC_APPLE_CLIENT_ID` is set.
- Practical note: Apple web SSO requires an Apple Services ID from an Apple Developer account (paid membership).
- For local setup, define:
  - root `.env`: `GOOGLE_CLIENT_ID=...`
  - root `.env`: `APPLE_CLIENT_ID=...`
  - `apps/frontend/.env.local`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`
  - `apps/frontend/.env.local`: `NEXT_PUBLIC_APPLE_CLIENT_ID=...`

## Data Quality & Migration Ops

```
# Scholar metadata quality report
npm run quality:scholars

# Local -> managed database handoff
./scripts/db-dump.sh /tmp/mufessir.dump
TARGET_DB_URL=postgresql://... ./scripts/db-restore.sh /tmp/mufessir.dump
```

See [Managed DB Migration Runbook](docs/MANAGED_DB_MIGRATION_RUNBOOK.md) for full cutover steps.

## Roadmap (Excerpt)
- CI: lint → type-check → test → migrate → deploy
- Observability: structured logging and basic tracing
- Cost controls: rate limiting and caching refinements
