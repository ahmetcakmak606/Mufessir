# T17 API Readiness Baseline

This document formalizes the previously-empty `T17` card in `MufessirAI_Project_Board_1.xlsx`.

## Objective
Provide a minimum, production-ready API contract for citation-grade tafsir responses before public API service work (`B14`).

## Required Endpoints
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /filters`
- `GET /verses`
- `POST /tafseer` (stream + non-stream)

## Readiness Criteria
1. `POST /tafseer` returns structured `confidence` and `citations`.
2. `GET /filters` exposes normalized metadata dimensions (`periodCode`, `madhab`, `sourceAccessibility`, etc.).
3. Structured logs include request path, status code, and latency.
4. CI checks: lint, type-check, backend tests, migration verification.
5. Data-quality gate script exists and can run in strict or non-strict mode.

## Dependency Mapping
- Upstream: `T01`, `T01a`, `T01b`, `T02`, `T03`, `T10`
- Downstream: `B14` (3rd-party API service)
