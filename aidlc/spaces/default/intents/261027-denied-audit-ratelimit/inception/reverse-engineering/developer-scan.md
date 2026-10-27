# Developer Code Scan: denied-audit rate limit (focused)

Intent `denied-audit-ratelimit` (record `261027-denied-audit-ratelimit`), brownfield, scope express, depth Minimal. Focused scan of `supabase` and `tests/database` at HEAD `5d2b484d7b1ec7ad56286f503532016672bdde82` (branch `ci/fit-free-actions-minutes`), 2026-10-27. Read-only: no test, build or program was run.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - supabase/migrations/20261012_platform_audit.sql
  - supabase/migrations/20261013_platform_idempotency.sql
  - supabase/migrations/20261015_identity_session.sql
  - supabase/migrations/20261019_identity_privileges.sql
  - supabase/migrations/20261044_audit_purge.sql
  - supabase/migrations/20261045_audit_purge_isolation.sql
  - supabase/config.toml
  - tests/database/stack-support.ts
  - tests/database/audit.test.ts
  - tests/database/audit-purge.test.ts
  - tests/database/migrations.test.ts
- **Skimmed only**:
  - supabase/migrations/ (all other files: grep for `platform_audit_write`, `platform_finish_operation`, `identity_deny`, `audit_events`; read 20261014 lines 75-95 and 20261018 lines 40-89)
  - tests/database/ (other test files: denial-assertion counts and loops of 20 or more iterations)
  - supabase/roles.sql, supabase/templates/ (not opened beyond the listing)
  - scripts/db/ (runner.ts checksum and schema-neutral rules, worker.ts `resetWorkerData`, shuffled-tests.ts file list); outside the snapshot, shallow
  - scripts/verification/run-local-verification.ts (database steps), package.json (npm scripts), .github/workflows/ci.yml (run steps), src/data/gateway.ts (RPC mapping); outside the snapshot, shallow
- **Left out**: node_modules/, .next/, coverage/ (dependencies, build output, caches); AI-DLC install and `aidlc/` workspace

### Packages Found
- waldorf-community-task-manager - single npm package - TypeScript + PostgreSQL SQL - Next.js app with a Supabase (Postgres) backend defined by 39 forward-only migration files

### Build System
- **Type**: npm (Node 24), SQL migrations applied by the project's own runner (`npm run db:migrate`, `scripts/db/runner.ts`); Supabase CLI migrations are switched off (`supabase/config.toml` `[db.migrations] enabled = false`)
- **Config Files**: `package.json`, `supabase/config.toml` (Postgres 17, API schemas `public`, `worker_1`..`worker_4`, ports 54321/54322)
- **Build Dependencies**: tests/database -> scripts/db (runner, worker, migrate, common) -> supabase/migrations

### APIs Discovered
- PostgreSQL functions called through the data API RPC (`src/data/gateway.ts` `client.rpc(name, args)`), each returning the envelope `{state, reference, code}` built by `platform_result` (20261013:23-26)
- Internal audit API (not callable by any application role): `platform_audit_write(p_action, p_target_type, p_target_id, p_organization_id, p_group_id, p_outcome, p_details) returns uuid` (20261012:94-108)

### Frameworks & Libraries
- PostgreSQL 17 (local Supabase stack), plpgsql, `pgcrypto`-style `gen_random_uuid()`, `sha256()`
- node:test + node:assert (via `node --experimental-strip-types --test`) - database test runner
- pg (node-postgres) - test client in `tests/database/stack-support.ts`

### Test Coverage
- **Test Directories**: `tests/database/` (55 files, real local stack, never a mock)
- **Test Frameworks**: node:test
- **Coverage Config**: absent for the database layer (SQL is not in any coverage denominator)

### Code Quality Indicators
- **Linting**: ESLint/Prettier cover `tests/` (TypeScript); no SQL linter. Runner refuses hard-coded schema names and fixed search paths (`scripts/db/runner.ts:41-55`)
- **CI/CD**: `.github/workflows/ci.yml` runs `npm run db:start` then `npm run verify:local`, which runs every `test:database:*` script plus `test:database:shuffled`
- **Documentation**: every migration starts with a comment block naming its unit, business rules (BR/NFR ids) and, for follow-ups, "Forward-only: the merged file X is not edited"

### Technical Debt Signals
- `audit_events` has no outcome-aware index; a per-account count of denied events can use `audit_events_actor (actor_account_id, occurred_at desc)` but must re-check `outcome` on each row (20261012:78)
- Count-then-insert patterns have no serialization unless an advisory lock is taken; the idempotency check shows the project's pattern (`pg_advisory_xact_lock(hashtextextended(current_schema() || '|' || ...))`, 20261013:38)
- Database test files must be registered by hand in two lists (an npm `test:database:*` script and `scripts/db/shuffled-tests.ts`); a forgotten entry means CI never runs the file
- Four files share the prefix `20261035_`; ordering relies on the full-name sort

## Handoff Summary
- **Intent-relevant finding**: Every audit event is written by one function, `platform_audit_write` (`supabase/migrations/20261012_platform_audit.sql:94-108`), defined once and never redefined. Denied events reach it only through `platform_finish_operation` (`20261013_platform_idempotency.sql:82-95`, `if p_state in ('success','denied') then perform platform_audit_write(...)`), directly or via `identity_deny` (`20261015_identity_session.sql:120-126`). All seven direct callers of `platform_audit_write` pass `'success'` (20261018:277, 20261029:677/682, 20261032:172/178, 20261035_integrity_lifecycle:119/125, 20261041:438). The account key is `platform_actor_account()` (redefined in 20261015:51-67: `auth.uid()` with an active session, or the nil system account `00000000-...` for `postgres`/`service_role`/`supabase_admin`). Because `platform_finish_operation` uses `perform` and stores the idempotency result and returns `platform_result(p_state, ...)` independently of the audit write, skipping the insert inside `platform_audit_write` for an over-limit denial leaves the returned `denied` result and replay behaviour unchanged. A forward-only `create or replace function platform_audit_write(...)` in a new file `supabase/migrations/20261046_<name>.sql` (last file today: `20261045_audit_purge_isolation.sql`) is the single change point; it must restate the `revoke all ... from public, anon, authenticated, service_role` (20261012:109) and keep `security definer set search_path from current`.
- **Risks / follow-up**:
  - Requirements must fix the window ("about 20 per hour": sliding 60 minutes vs clock hour; whether the 21st or later is dropped) and whether the nil system account is exempt.
  - `occurred_at` defaults to `now()` (transaction start); several denials in one transaction share a timestamp.
  - Concurrent denials of one account can exceed the cap without a per-account advisory lock; "about 20" may tolerate this, but it should be a stated decision.
  - The runner refuses any change to an applied file (checksum check, `scripts/db/runner.ts:146-151`); never edit 20261012 or 20261013.
  - Existing tests: `resetWorkerData` truncates every table before each test, so only within-test denial counts matter; the grep found no loop that produces 20 or more denials for one account, but this is unverified until the full database suites run.
  - Real-stack tests follow `audit.test.ts`: loop over `["worker_1", "public"]`, `lockSchemas` + `prepareSchema` in `before`, `resetWorkerData` + `seedGrants` in `beforeEach`, generate denials with `lifecycle_hold_place` as `PARENT` or `OUTSIDER` (audit.test.ts:180-203), and age events by inserting `occurred_at` through the owner connection (audit-purge.test.ts:43-50). A new test file must be added to an npm `test:database:*` script and to `scripts/db/shuffled-tests.ts`; `migrations.test.ts` holds one "applies file X after Y" test per follow-up file.
  - The audit read policy (20261015:152-155) lets admins see denied events; suppressed denials are, by design, invisible to them.
