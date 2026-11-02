# Component Inventory

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. The 2026-10-27 update rewrote `supabase/migrations` and added `tests/database`; the 2026-11-02 update rewrote `app`, `src/runtime`, `proxy.ts` and added `src/identity`, `tests/integration` and `tests/browser/support` (all analyzed 2026-11-02). Every other entry is kept from 2026-10-12 (Wiring column: Wired = called by `app/` then; Unwired = referenced only by itself and tests) and does not list modules added since (`src/data`, `src/identity`, `scripts/db`).

## Summary table

| Component | Wiring | Responsibility | Depends on |
|---|---|---|---|
| app | Wired | Pages, layouts, server actions, session and home resolvers (`app/_identity`), role shells (2026-11-02) | src/runtime, src/identity, src/application, src/data |
| proxy.ts | Wired (2026-11-02) | CSP nonce and session cookie renewal or clearing | src/identity |
| src/identity | Wired (2026-11-02) | Sign-in, session, cookies, refresh, invitations, reset, accounts, Hungarian copy | src/runtime/database, Supabase sign-in service |
| tests/integration | Verification (2026-11-02) | Vitest tests of actions, screens, wiring and shell | app, src |
| tests/browser/support | Verification (2026-11-02) | Seeded-schema helpers for Playwright specs | scripts/db |
| src/application | Wired | Authorization, pipeline, idempotency, result model, facades | src/access (types, role-policy, session-grants), src/teacher-tracking |
| src/runtime | Wired | Config, production-only composition, role access resolvers, menus, UI shell (2026-11-02) | src/application, src/data |
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
| supabase/migrations | Applied by `npm run db:migrate` (2026-10-27; audit files re-verified 2026-11-02) | 40 forward-only SQL files: schema, RLS, named audited functions, audit log | PostgreSQL 17, Supabase `auth` schema, `scripts/db/runner.ts` |
| tests/database | Verification (2026-10-27) | Real-stack database tests and their helpers | supabase/migrations, scripts/db, local Supabase stack |
| tests | Verification | Unit, integration, coverage, browser layers | all |
| scripts | Tooling | Config validation, toolchain, smoke, local verification, database tooling | node, Supabase CLI stack |
| verification | Tooling data | Manifests and runbooks | scripts |

## Component details

### app
Analyzed 2026-11-02 for the sign-in area (`bejelentkezes`, `page.tsx`, `_identity`); the role layouts and `teacher/schedule/page.tsx` were skimmed. Next.js route tree (see `code-structure.md`, "Sign-in and shell files"). `app/_identity` holds the session and home resolvers, sign-out action and shell header control. Layouts gate admin and teacher by `redirect("/")`, parent by an access panel. `/bejelentkezes` sits outside every role layout and therefore has no shell.

### src/application
Facades (`parent`, `teacher`, `admin`, `session`), `FacadePipeline`, `AuthorizationContract`, in-memory versions, idempotency store and journal; ports listed in `code-structure.md` (2026-10-12).

### src/runtime
Analyzed 2026-11-02. `validateRuntimeConfig`, `composeRuntime` (always production), `production/composition.ts` (cached database client per URL, schema and key), `production/services.ts` (`forRequest(accessToken)` facades), `production/access.ts` (parent, admin, teacher access resolvers, `HOME`, `HOME_ORDER`), `navigation.ts` (four menu lists), `shell-profile.ts`, `AppShell.tsx` (menu only when the list is non-empty), `AppNav.tsx` (client; marks the current item by path, keeps "Értesítések" current for a task opened from a notification), `BrandMark`, `BackToHomeLink`, `StatusBadge`, `FilterClearLink`, `RuntimeConfigurationError`, hyphenation. The synthetic composition, profiles and cookie of 2026-10-12 are gone.
- Role shells: parent (menu of 3), teacher (menu of none by design; page `/teacher/schedule`), group admin (5), super admin (9).

### proxy.ts
Analyzed 2026-11-02. Request proxy: CSP with per-request nonce; when a `wb_refresh` cookie exists it calls `decideRefresh` and renews or clears the token cookies on both the request (so the page sees the new tokens) and the response. Signed-out requests take the synchronous path.

### src/identity
Analyzed 2026-11-02 (sign-in head, cookies and copy read; the rest listed). Modules: `sign-in.ts` (generic failure, lockout, hourly housekeeping), `session.ts` (`resolveSession`, `endSession`), `cookies.ts`, `refresh.ts`, `service.ts` and `admin-client.ts` (sign-in service and admin access), `accounts.ts`, `invitations.ts`, `reset.ts`, `password.ts`, `crypto.ts`, `events.ts`, `mail.ts`, `form-state.ts`, `copy.ts` (Hungarian texts, including `signIn.signedInHeading`), `runtime.ts` (`getIdentityRuntime`), each with a colocated test.

### tests/integration
Analyzed 2026-11-02 (28 files listed; sign-in related parts read). Tests that pin the sign-in landing: `identity-actions.test.ts` (redirect `/bejelentkezes` after sign-in, reset, invitation), `identity-screens.test.tsx` (signed-in visitor sees `signed-in-panel`), `production-home.test.tsx` (home resolution and `/` redirect), `identity-proxy.test.ts`, `runtime-shell.test.tsx`, `app-nav.test.tsx`.

### tests/browser/support
Analyzed 2026-11-02. `seeded-schema.ts`: `bindSeededSchema` (empties and seeds the schema of the browser project in `beforeAll`), `signInAs` (opens `/bejelentkezes`, signs out an existing session, fills the form, clicks submit and waits for `signed-in-panel`, returns elapsed milliseconds), `signOut` (sign-out button, waits for `sign-in-form`), `signInAndOpen`. `projects.ts`: chromium `worker_1`, firefox `worker_2`, mobile-chrome `worker_3`, one port offset each. `signed-in-panel` is awaited directly in 12 more places across `identity.spec.ts`, `directory-coordination.spec.ts`, `notifications-import.spec.ts` and `visual-overhaul.spec.ts`.

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
Analyzed 2026-10-27 for the audit area and re-read in full on 2026-11-02 (20261012, 20261013, 20261015, 20261019, 20261044, 20261045); the other 34 files by name. 20261046 (denied-event limit) is known from its header only. Unit map and naming in `code-structure.md`.
- **Audit log (U1, 20261012)**: table `audit_events`, append-only trigger `audit_events_refuse_change`, the single writer `platform_audit_write`, actor helpers `platform_system_account`, `platform_caller_is_system`, `platform_actor_account`, `platform_actor_role`.
- **Audited-operation wrapper (U1, 20261013)**: `platform_result`, `platform_idempotency_check`, `platform_idempotency_store`, `platform_finish_operation` (writes the audit event for `success`/`denied`), `platform_cleanup_expired`, the hold functions.
- **Identity changes to the audit area (U2)**: action list widened (20261014:88-95, not re-read), active-session check in `platform_actor_account`, `current_session_is_active`, `identity_*` helpers, `identity_deny` wrapper and audit read policy (20261015), privilege sweep and service-role grant list (20261019). Responsibilities and rights: `architecture.md` "Privilege model".
- **Purge (U5, B1)**: `audit_purge` (365 days, at most 5000 rows per call) and `identity_housekeeping` (20261044, 20261045).
- Responsibility for intent `denied-audit-ratelimit` (done): the per-account limit lives in the new file `20261046_audit_denied_rate_limit.sql`, which redefines `platform_audit_write`; no merged file was changed (runner checksum).
- Depends on: `auth.uid()`, `auth.jwt()`, `auth.sessions`, `auth.users` of the Supabase sign-in service; roles `anon`, `authenticated`, `service_role`.

### tests/database
Analyzed 2026-10-27 and re-read 2026-11-02: `stack-support.ts`, `audit.test.ts`, `audit-purge.test.ts`, `migrations.test.ts`; the other 54 entries (58 at HEAD, including `audit-denied-limit.test.ts` for the new limit) skimmed by name.
- Helpers in `stack-support.ts` (see `code-structure.md` "Database tests"); per-schema advisory locks; `resetWorkerData` from `scripts/db/worker.ts` truncates every table before each test.
- `audit.test.ts`: refused write/insert/update/delete for application roles, admin read policy, actor from the session, system actor, denied event committed with denied result (lines 180-203), rollback on injected failure, `details` format, check lists, indexes, under-50-ms overhead (NFR4.5).
- `stack-support.ts` also fixes the shared identities (`SUPER_ADMIN`, `PARENT`, `OUTSIDER`, `OTHER_ADMIN`, two organizations), gives each test process its own session ids and takes per-schema advisory locks. The stack config these tests run against is `supabase/config.toml` (see `architecture.md`).
- `audit-purge.test.ts`: 365-day boundary, system-caller-only, setting scope, 5000-row cap, security-definer and pinned search path.
- `migrations.test.ts`: applies all files to an empty database and to `worker_4`, second run changes nothing, pinned search path for every function, platform table rights, per-unit and per-follow-up ordering tests, refusal of hard-coded schemas and failing files.
- Run by npm scripts `test:database:stack` (migrations, audit, idempotency, holds, worker), `test:database:seed` (audit-purge, seed, reset, seed-timing) and others, and by `scripts/db/shuffled-tests.ts`; all inside `npm run verify:local` in CI after `npm run db:start`.

### tests
- `src/**/*.test.ts` (node tests), `tests/unit`, `tests/integration`, `tests/coverage` (Vitest), `tests/browser` (Playwright) as of 2026-10-12; `tests/database` above.

### scripts
`validate-runtime-config.ts`, `validate-toolchain.mjs`, `start-smoke.mjs`, `verification/*` (2026-10-12); `db/*` (start, stop, migrate, runner, worker, seed, reset, shuffled tests, first super admin) seen in the 2026-10-27 skim.

### verification
`authorization-matrix.json`, `fixtures.json`, `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `RUNBOOK.md`, `AUTHORIZATION.md` (2026-10-12).
