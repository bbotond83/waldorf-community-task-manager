# Component Inventory

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`). The focused update rewrote `supabase/migrations` and added `tests/database`; both were analyzed on 2026-10-27. Every other entry is kept from 2026-10-12 (Wiring column: Wired = called by `app/` then; Unwired = referenced only by itself and tests) and does not list modules added since (`src/data`, `src/identity`, `scripts/db`).

## Summary table

| Component | Wiring | Responsibility | Depends on |
|---|---|---|---|
| app | Wired | Pages, layouts, actions, API routes, session/facade resolvers | src/runtime, src/application, adapters |
| src/application | Wired | Authorization, pipeline, idempotency, result model, facades | src/access (types, role-policy, session-grants), src/teacher-tracking |
| src/runtime | Wired | Config, composition, session cookie, synthetic profiles, UI shell | src/application |
| src/parent-web | Wired | In-memory parent port | src/application |
| src/admin-core | Wired | In-memory admin port | src/application |
| src/admin-advanced | Wired | In-memory import/reminder/governance/lifecycle/settings | src/application, src/runtime |
| src/teacher-web | Wired | Teacher schedule adapter | src/application, src/teacher-tracking |
| src/teacher-tracking | Partly wired | Tracking model plus unwired service | none |
| src/access | Mostly unwired | Access service, grants, RPC adapter | none |
| src/coordination | Unwired | Sign-up/swap domain service | none |
| src/directory | Unwired | Families/children/parents | none |
| src/import-migration | Unwired | Import service, 17-sheet registry | none |
| src/notifications | Unwired | Reminder thresholds, durable jobs | none |
| src/parent-experience | Unwired | Parent read model | none |
| src/privacy-audit | Unwired | Retention lifecycle | none |
| src/admin-experience | Unwired | Admin authorization shell | src/import-migration |
| supabase/migrations | Applied by `npm run db:migrate` (2026-10-27) | 39 forward-only SQL files: schema, RLS, named audited functions, audit log | PostgreSQL 17, Supabase `auth` schema, `scripts/db/runner.ts` |
| tests/database | Verification (2026-10-27) | Real-stack database tests and their helpers | supabase/migrations, scripts/db, local Supabase stack |
| tests | Verification | Unit, integration, coverage, browser layers | all |
| scripts | Tooling | Config validation, toolchain, smoke, local verification, database tooling | node, Supabase CLI stack |
| verification | Tooling data | Manifests and runbooks | scripts |

## Component details

### app
Next.js route tree (see `code-structure.md`); 5 server action files; layouts gate admin/teacher by redirect, parent by access panel (2026-10-12).

### src/application
Facades (`parent`, `teacher`, `admin`, `session`), `FacadePipeline`, `AuthorizationContract`, in-memory versions, idempotency store and journal; ports listed in `code-structure.md` (2026-10-12).

### src/runtime
`validateRuntimeConfig`, `composeRuntime`, session cookie signing, synthetic profiles, `access-state.ts`, UI shell (2026-10-12).

### src/parent-web
`SyntheticParentPort` on `globalThis`, `createSyntheticParentFacade`, `notification-context.ts` (2026-10-12).

### src/admin-core
`SyntheticAdminPort` with fixture records, tasks and approvals (2026-10-12).

### src/admin-advanced
`AdvancedWorkflowStore`, `CompositeAdminPort` (13 routed operations), reset helpers (2026-10-12).

### src/teacher-web
`SyntheticTeacherScheduleAdapter`, `SYNTHETIC_SCHEDULE` (2026-10-12).

### src/teacher-tracking
Tracking model (live) and `TeacherScheduleService` (unwired) (2026-10-12).

### src/access
`AccessService`, `convertLegacyRoles`, in-memory adapters, `SupabaseRouteAdapter`; live pieces `types.ts`, `role-policy.ts`, `session-grants.ts` (2026-10-12).

### src/coordination, src/directory, src/import-migration, src/notifications, src/parent-experience, src/privacy-audit, src/admin-experience
Family B domain services with synchronous ports and in-memory adapters (2026-10-12).

### supabase/migrations
Analyzed 2026-10-27 for the audit area; the rest by grep. Unit map and naming in `code-structure.md`.
- **Audit log (U1, 20261012)**: table `audit_events`, append-only trigger `audit_events_refuse_change`, the single writer `platform_audit_write`, actor helpers `platform_system_account`, `platform_caller_is_system`, `platform_actor_account`, `platform_actor_role`.
- **Audited-operation wrapper (U1, 20261013)**: `platform_result`, `platform_idempotency_check`, `platform_idempotency_store`, `platform_finish_operation` (writes the audit event for `success`/`denied`), `platform_cleanup_expired`, the hold functions.
- **Identity changes to the audit area (U2)**: action list widened (20261014:88-95), active-session check in `platform_actor_account` and `identity_deny` wrapper and audit read policy (20261015), privilege sweep (20261019).
- **Purge (U5, B1)**: `audit_purge` (365 days, at most 5000 rows per call) and `identity_housekeeping` (20261044, 20261045).
- Responsibility for intent `denied-audit-ratelimit`: the per-account limit belongs in a new file (`20261046_...`) that redefines `platform_audit_write`; no merged file may change (runner checksum).
- Depends on: `auth.uid()`, `auth.jwt()`, `auth.sessions`, `auth.users` of the Supabase sign-in service; roles `anon`, `authenticated`, `service_role`.

### tests/database
Analyzed 2026-10-27: `stack-support.ts`, `audit.test.ts`, `audit-purge.test.ts`, `migrations.test.ts`; the other 51 files skimmed.
- Helpers in `stack-support.ts` (see `code-structure.md` "Database tests"); per-schema advisory locks; `resetWorkerData` from `scripts/db/worker.ts` truncates every table before each test.
- `audit.test.ts`: refused write/insert/update/delete for application roles, admin read policy, actor from the session, system actor, denied event committed with denied result (lines 180-203), rollback on injected failure, `details` format, check lists, indexes, under-50-ms overhead (NFR4.5).
- `audit-purge.test.ts`: 365-day boundary, system-caller-only, setting scope, 5000-row cap, security-definer and pinned search path.
- `migrations.test.ts`: applies all files to an empty database and to `worker_4`, second run changes nothing, pinned search path for every function, platform table rights, per-unit and per-follow-up ordering tests, refusal of hard-coded schemas and failing files.
- Run by npm scripts `test:database:stack` (migrations, audit, idempotency, holds, worker), `test:database:seed` (audit-purge, seed, reset, seed-timing) and others, and by `scripts/db/shuffled-tests.ts`; all inside `npm run verify:local` in CI after `npm run db:start`.

### tests
- `src/**/*.test.ts` (node tests), `tests/unit`, `tests/integration`, `tests/coverage` (Vitest), `tests/browser` (Playwright) as of 2026-10-12; `tests/database` above.

### scripts
`validate-runtime-config.ts`, `validate-toolchain.mjs`, `start-smoke.mjs`, `verification/*` (2026-10-12); `db/*` (start, stop, migrate, runner, worker, seed, reset, shuffled tests, first super admin) seen in the 2026-10-27 skim.

### verification
`authorization-matrix.json`, `fixtures.json`, `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `RUNBOOK.md`, `AUTHORIZATION.md` (2026-10-12).
