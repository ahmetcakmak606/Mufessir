## Managed DB Migration Runbook

This runbook describes the practical steps for handing off the self-hosted `mufessir` Postgres instance to a managed Postgres provider while keeping the citable-core API (`/tafseer`, `/filters`, `/verses`, auth) available and verifiably correct.

The goal is to:

- Minimize downtime and data loss.
- Preserve pgvector and Prisma schema compatibility.
- Keep the **T17 API Readiness Baseline** guarantees intact before and after migration.

### 1. Pre‑migration checks

- **Schema freeze**: Pause schema changes until the managed DB is live.
- **Health and CI**:
  - Ensure `npm run lint`, `npm run check-types`, and `npm run test` are green.
  - Confirm `npm run db:migrate` and `npm run db:seed` succeed against local pgvector.
- **Capacity estimate**:
  - From the current primary: record total DB size, Tafsir row count, and index sizes.
  - Verify the target managed plan has sufficient storage, IOPS, and connection limits.
- **Extension support**:
  - Confirm `pgvector` (or an equivalent vector extension) is available on the target service.
  - If a different vector extension is used, document the mapping and required Prisma changes.

### 2. One‑time baseline dump

All dump/restore operations are performed from the application repo root using the helper scripts in `scripts/`.

1. **Create a clean logical backup** of the current primary:
   - Use `scripts/db-dump.sh` to produce a timestamped dump artifact.
   - Store the dump in a secure, access‑controlled bucket (not in the git repo).
2. **Record metadata** alongside the dump:
   - Git commit hash of the application.
   - Prisma migration history (`prisma/migrations/*` directory hash).
   - PostgreSQL version and extension versions.

### 3. Managed DB rehearsal (dry run)

Perform a full rehearsal before any production cutover.

1. **Provision a managed Postgres instance** in the target region with:
   - `pgvector` (or equivalent) installed.
   - Database name, user, and password dedicated to Mufessir.
2. **Restore from dump**:
   - Use `scripts/db-restore.sh` against the managed instance.
   - Verify migrations are already applied and Prisma reports no pending migrations.
3. **Point a staging backend at the managed DB**:
   - Set `DATABASE_URL` / `SHADOW_DB_URL` to the managed instance.
   - Run:
     - `npm run db:migrate`
     - `npm run test:backend`
4. **Smoke test API readiness** against the managed DB:
   - `GET /health`, `GET /filters`, `GET /verses`.
   - `POST /tafseer` (non‑stream + stream), confirming confidence and citations fields.
   - `GET /tafseer/runs` list/detail; `PATCH /tafseer/runs/:runId` metadata updates.

### 4. Cutover plan

When the rehearsal is successful and signed off:

1. **Schedule a maintenance window** and communicate expected impact.
2. **Quiesce writes**:
   - Temporarily disable public traffic or set the app to read‑only mode if supported.
   - Ensure no background jobs or scripts are mutating the DB.
3. **Take a final incremental dump**:
   - Run `scripts/db-dump.sh` again just before cutover.
   - Restore this final dump into the managed instance.
4. **Reconfigure application**:
   - Update production `DATABASE_URL` / `SHADOW_DB_URL` secrets to point at the managed DB.
   - Restart application processes or redeploy.
5. **Post‑cutover verification**:
   - Re‑run the T17 baseline checks:
     - API endpoints respond successfully.
     - Logs include path, status code, and latency.
   - Run a small set of canonical tafsir queries and check that:
     - Response structure (confidence, citations, source excerpts) is unchanged.
     - Performance is within acceptable latency bounds.

### 5. Rollback strategy

If major issues are discovered during or immediately after cutover:

1. **Trigger rollback**:
   - Revert application secrets to point back to the original Postgres instance.
   - Redeploy the backend.
2. **Data reconciliation**:
   - If writes occurred on the managed instance before rollback, decide whether to:
     - Accept data loss between managed and original instances, or
     - Plan a later one‑way sync from managed back to self‑hosted with a targeted script.
3. **Root‑cause analysis**:
   - Capture logs, slow queries, and error rates from the managed service.
   - Document fixes required before attempting a second cutover.

### 6. Observability and ongoing operations

After a successful cutover:

- **Dashboards**:
  - Track `/tafseer` latency, error rate, and token usage.
  - Monitor DB CPU, memory, IOPS, and connection saturation.
- **Alerts**:
  - Alert on sustained error spikes for `/tafseer` and `/filters`.
  - Alert on near‑capacity storage or exhausted connections.
- **Change management**:
  - Require Prisma migration rehearsal against a staging managed DB before applying to production.
  - Keep this runbook updated when DB provider, region, or extension strategy changes.

