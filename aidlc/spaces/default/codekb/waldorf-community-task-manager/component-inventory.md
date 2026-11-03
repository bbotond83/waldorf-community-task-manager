# Component Inventory

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. Focused update 2026-11-02 (HEAD `1070fd6`, intent `no-access-signout`): the "Nincs jogosultság" components and the sign-out reuse path (new section "Denied-state and sign-out components (2026-11-02, after 1070fd6)"); `app`, `src/runtime`, `src/identity` copy, `proxy.ts` and `tests/browser` were re-read for it. The 2026-10-27 update rewrote `supabase/migrations` and added `tests/database`; the 2026-11-02 update (`3456409`) rewrote `app`, `src/runtime`, `proxy.ts` and added `src/identity`, `tests/integration` and `tests/browser/support`. Every other entry is kept from 2026-10-12 (Wiring column: Wired = called by `app/` then; Unwired = referenced only by itself and tests) and does not list modules added since (`src/data`, `src/identity`, `scripts/db`).

## Summary table

| Component | Wiring | Responsibility | Depends on |
|---|---|---|---|
| app | Wired | Pages, layouts, server actions, session and home resolvers (`app/_identity`), role shells, access-state (denied) components (2026-11-02) | src/runtime, src/identity, src/application, src/data |
| proxy.ts | Wired (2026-11-02) | CSP nonce and session cookie renewal or clearing | src/identity |
| src/identity | Wired (2026-11-02) | Sign-in, session, cookies, refresh, invitations, reset, accounts, Hungarian copy | src/runtime/database, Supabase sign-in service |
| tests/integration | Verification (2026-11-02) | Vitest tests of actions, screens, wiring and shell | app, src |
| tests/browser | Verification (2026-11-02) | Playwright specs, axe checks and seeded-schema helpers (`support/`) | scripts/db |
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

## Denied-state and sign-out components (2026-11-02, after 1070fd6)

| Component | File | Kind | Notes |
|---|---|---|---|
| `SignOutButton` | `app/_identity/SignOutButton.tsx` | Client component (`"use client"`), no props | `<form action={signOutAction} data-testid="sign-out-form">` plus submit button `secondary-button`, `data-testid="sign-out-button"`; label "Kijelentkezés", pending text "Kijelentkezés folyamatban…" from `COPY.signOut` (`src/identity/copy.ts`). Import as `import { SignOutButton } from "../../_identity/SignOutButton.tsx";` (relative depth depends on the file). |
| `signOutAction` | `app/_identity/actions.ts` | Server action (`"use server"`) | Ends the session (scope local) via `endSession`, emits `sign_out`, clears cookies with `clearTokenPair`, always `redirect("/bejelentkezes")`; tolerates missing configuration or network errors. No new action is needed. |
| `shellHeaderAction()` | `app/_identity/shell-action.tsx` | Service | Supplies `SignOutButton` as the `AppShell` `headerAction` for the three role layouts. |
| `ParentAccessState` | `app/szulo/_components/ParentAccessState.tsx` | Component | Kinds `denied`, `configuration-error`, `signed-out`. Denied markup: `section#hozzaferes-megtagadva` (`tabIndex={-1}`, `data-testid="parent-access-denied"`), single `<h1>Nincs jogosultság</h1>`, paragraph "A kért tartalom nem érhető el ezzel a profillal.", `BackToHomeLink` (`parent-access-home-link`, "Vissza a biztonságos kezdőoldalra"). No sign-out. Rendered by `app/szulo/layout.tsx` outside `AppShell`. |
| `AdminAccessState` | `app/admin/_components/AdminAccessState.tsx` | Component | Testids `admin-denied`, `admin-access-state-home-link`; no sign-out; rendered by `app/admin/layout.tsx`. |
| `TeacherAccessState` | `app/teacher/_components/TeacherAccessState.tsx` | Component | Testids `teacher-denied`, `teacher-access-home-link`; link goes to `/`; no sign-out; rendered by `app/teacher/layout.tsx`. |
| Static denied page | `app/hozzaferes-megtagadva/page.tsx` | Page | `access-denied-state`, `access-denied-home-link`; no inbound redirect found in `app/` or `src/`; only rendered by `tests/coverage/app-entrypoints.test.tsx`. Possibly legacy. |
| `BackToHomeLink` | `src/runtime/BackToHomeLink.tsx` | Component | Link used by the access states; target comes from the denied result's `homePath`, which can equal the current page. |
| `AppShell` | `src/runtime/AppShell.tsx` | Component | Needs a `ShellProfile`; not usable for a denied person. |
| `app/page.tsx` no-role branch | `app/page.tsx` | Page branch | `role="status"` paragraph (`production-no-role`) plus `<SignOutButton />`: the existing "explanation plus sign-out" pattern and nearest copy precedent ("Ehhez a fiókhoz még nem tartozik szerepkör. Kérje az adminisztrátort, hogy hívja meg."). |

Ownership: the three access-state components are owned by their role areas (`app/szulo/`, `app/admin/`, `app/teacher/`); `SignOutButton` and `signOutAction` are owned by `app/_identity/`. Session handling is outside both (`src/identity`, `proxy.ts`).

## Component details

### app
Analyzed 2026-11-02 for the sign-in area (`bejelentkezes`, `page.tsx`, `_identity`) and re-read for the denied pages (layouts and access-state components of `szulo`, `teacher`, `admin`, `hozzaferes-megtagadva`; see the section above). Next.js route tree (see `code-structure.md`, "Sign-in and shell files"). `app/_identity` holds the session and home resolvers, sign-out action and button, and shell header control. Layouts gate admin and teacher by `redirect("/")`, parent by an access panel; all three render their access state outside `AppShell`. `/bejelentkezes` sits outside every role layout and therefore has no shell. After `1070fd6` `signInAction` redirects to `/`.

### src/application
Facades (`parent`, `teacher`, `admin`, `session`), `FacadePipeline`, `AuthorizationContract`, in-memory versions, idempotency store and journal; ports listed in `code-structure.md` (2026-10-12). Not re-read in this run; the handoff notes that `src/application/results.ts` and `facade-pipeline.ts` carry `focusTarget: "#hozzaferes-megtagadva"`.

### src/runtime
Analyzed 2026-11-02 and re-read for role access resolution. `validateRuntimeConfig`, `composeRuntime` (always production), `production/composition.ts` (cached database client per URL, schema and key), `production/services.ts` (`forRequest(accessToken)` facades), `production/access.ts` (parent, admin, teacher access resolvers, `HOME`, `HOME_ORDER`, `deniedFor`; returns the `denied` result with the strongest role's `homePath`; `resolveParentAccess` is `denied` for a parent role without a linked `parents` record or with a grant scope not matching the record's family), `navigation.ts` (four menu lists), `shell-profile.ts`, `AppShell.tsx` (menu only when the list is non-empty), `AppNav.tsx` (client; marks the current item by path, keeps "Értesítések" current for a task opened from a notification), `BrandMark`, `BackToHomeLink`, `StatusBadge`, `FilterClearLink`, `RuntimeConfigurationError`, hyphenation. The synthetic composition, profiles and cookie of 2026-10-12 are gone.
- Role shells: parent (menu of 3), teacher (menu of none by design; page `/teacher/schedule`), group admin (5), super admin (9).

### proxy.ts
Analyzed 2026-11-02. Request proxy: CSP with per-request nonce and `form-action 'self'`; when a `wb_refresh` cookie exists it calls `decideRefresh` and renews or clears the token cookies on both the request (so the page sees the new tokens) and the response. Signed-out requests take the synchronous path. No role routing.

### src/identity
Analyzed 2026-11-02 (sign-in head, cookies and copy read; the rest listed). Modules: `sign-in.ts` (generic failure, lockout, hourly housekeeping), `session.ts` (`resolveSession`, `endSession`), `cookies.ts` (`clearTokenPair`, `writeTokenPair`), `refresh.ts`, `service.ts` and `admin-client.ts` (sign-in service and admin access), `accounts.ts`, `invitations.ts`, `reset.ts`, `password.ts`, `crypto.ts`, `events.ts`, `mail.ts`, `form-state.ts`, `copy.ts` (Hungarian texts, including `signIn.signedInHeading` and `COPY.signOut`), `runtime.ts` (`getIdentityRuntime`), each with a colocated test. Copy for identity features lives in `COPY`; role pages mostly keep their Hungarian strings inline.

### tests/integration
Analyzed 2026-11-02 (28 files listed; sign-in related parts read). Tests that pin the sign-in landing: `identity-actions.test.ts`, `identity-screens.test.tsx` (including `describe("SignOutButton (BR2.8)")`), `production-home.test.tsx` (home resolution, `/` redirect, no-role with sign-out), `identity-proxy.test.ts`, `runtime-shell.test.tsx`, `app-nav.test.tsx`. For the denied pages: `parent-components.test.tsx` (`ParentAccessState` block) and `admin-components.test.tsx` (`AdminAccessState` block) (handoff, 2026-11-02, after 1070fd6). Note: after `1070fd6` the sign-in redirect expectation in `identity-actions.test.ts` is expected to read `/`; not re-read in this run.

### tests/coverage and tests/support
Mentioned from the handoff (2026-11-02): `tests/coverage/app-entrypoints.test.tsx` renders the static denied page; `tests/coverage/parent-pages.test.tsx` ("renders role layout, denial and configuration error") renders `app/szulo/layout.tsx` with `requestWorld.signIn("teacher")`; `tests/support/request-world.ts` offers `requestWorld.signIn(role)`, `requestWorld.access.parent.grants = []` and `requestWorld.access.parent.parent` (set `undefined` to model "role but no linked record"). The request is mocked with `vi.mock("../../app/_identity/production-request.ts", async () => (await import("../support/request-world.ts")).requestWorldModule())`. Not re-read in this store beyond the handoff.

### tests/browser
Analyzed 2026-11-02 (support) and skimmed by grep for denied-page and axe lines. `support/seeded-schema.ts`: `bindSeededSchema` (empties and seeds the schema of the browser project in `beforeAll`), `signInAs` (opens `/bejelentkezes`, signs out an existing session, fills the form, clicks submit and waits for `signed-in-panel` at `3456409`; per the handoff it now waits for a visible `sign-out-button`, so a denied page with a sign-out button would let it succeed for a no-record account), `signOut` (sign-out button, waits for `sign-in-form`), `signInAndOpen`, `expectSignedIn`, `SERIOUS` (axe impact filter). `projects.ts`: chromium `worker_1`, firefox `worker_2`, mobile-chrome `worker_3`, one port offset each. Axe checks use `new AxeBuilder({ page }).analyze()` filtered by `SERIOUS` (`visual-overhaul.spec.ts`, `identity.spec.ts`). Existing specs reach the denied page by `getByRole("heading", { name: "Nincs jogosultság", exact: true })` (`runtime-foundation.spec.ts`, `navigation-polish.spec.ts`, `teacher-web.spec.ts`). `identity.spec.ts` `newUser(...)` creates accounts with grants and adds the parent row explicitly for parents (after `1070fd6`); a variant without that insert would model a parent with no linked record. Whether the seeded accounts include an unlinked parent is not verified.

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
Analyzed 2026-10-27 for the audit area and re-read in full on 2026-11-02 (20261012, 20261013, 20261015, 20261019, 20261044, 20261045); the other 34 files by name. 20261046 (denied-event limit) is known from its header only. Unit map and naming in `code-structure.md`. Not re-read in the `no-access-signout` run.
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
