# TDD Workflow for MufessirAI

This project can now be developed in a practical test-driven way (red -> green -> refactor) across backend and frontend.

## 1) Core Principle

For each new feature or fix:
1. Write a failing test that describes expected behavior.
2. Implement the minimum code to make the test pass.
3. Refactor while keeping tests green.

Do not merge behavior changes without tests unless it is an urgent hotfix with follow-up test debt explicitly tracked.

## 2) Test Layers

### Backend
- Unit tests:
  - pure utilities (`apps/backend/src/utils/**`)
- Integration/API tests:
  - route behavior and contracts (`apps/backend/tests/app.test.ts`)
- Traceability/coverage checks:
  - board and artifact consistency (`apps/backend/tests/traceability.test.ts`)

### Frontend
- Unit tests:
  - pure transformation and mapping logic (`apps/frontend/src/lib/**/*.test.ts`)
- Component tests:
  - interaction and state behavior of isolated components (`apps/frontend/src/components/**/*.test.tsx`)
- Locale safety:
  - TR/EN parity tests (`apps/frontend/src/locales/index.test.ts`)

## 3) Commands

### Workspace
- `npm run test` -> run frontend and backend test suites
- `npm run test:coverage` -> run coverage gates for frontend and backend
- `npm run test:backend`
- `npm run test:frontend`
- `npm run test:e2e:frontend`

### Backend
- `npm --workspace apps/backend run test`
- `npm --workspace apps/backend run test:watch`
- `npm --workspace apps/backend run test:coverage`

### Frontend
- `npm --workspace apps/frontend run test`
- `npm --workspace apps/frontend run test:watch`
- `npm --workspace apps/frontend run test:coverage`
- `npm --workspace apps/frontend run test:e2e`

Playwright prerequisite (once per machine):
- `npm exec --workspace apps/frontend playwright install chromium`
- `npm --workspace apps/frontend run test:e2e -- --project=chromium-mobile` (run only mobile suite)
- `npm --workspace apps/frontend run test:e2e -- --project=chromium-iphone-mobile` (run iPhone-profile suite)

## 4) Definition of Done (Feature Level)

A feature is considered done when all are true:
- behavior covered by tests at the right layer
- tests pass locally
- lint and type-check pass
- no untranslated UI string additions (TR/EN parity remains green)
- API changes covered by contract tests (including SSE when relevant)
- frontend E2E checks include desktop and mobile parity for affected flows

## 5) Suggested Test-First Pattern by Task Type

### New API endpoint
1. Add failing integration test in `apps/backend/tests/app.test.ts`
2. Implement route/service
3. Add utility unit tests for edge cases

### New dashboard behavior
1. Add failing unit test for pure logic in `apps/frontend/src/lib`
2. Add failing component test for user interaction if needed
3. Implement UI wiring

### Bug fix
1. Reproduce bug in a test first
2. Fix with minimal code
3. Keep regression test permanently

## 6) CI Expectations

CI now treats frontend tests as a first-class gate in addition to backend tests, lint, and type-check. If a test fails, the change is not ready to merge.
