# Reverse Engineering: Developer Code Scan

Repository: `waldorf-community-task-manager` · commit `4845bb7ae2a39d7587ed2c518d1924512cfbe906` · full rescan, read-only (no tests, builds or programs were run).

## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply** (read and understood; every path is inside the snapshot path `./`):
  - `supabase/migrations/`: all directory, coordination, kernel, schedule, lifecycle, notification, import-schema, platform and core identity files read in full or in their defining sections. Partly read and otherwise understood from their function lists: `20261016`, `20261017`, `20261018`, `20261021`, `20261041` (last 130 lines), `20261043` (after line 120)
  - `supabase/config.toml`, `supabase/roles.sql`
  - `src/access/` (role policy, index; the rest by its importers)
  - `src/application/` (contracts, facades, pipeline, authorization, results, import upload)
  - `src/data/` (all ports and adapters; `admin-records.ts`, `imports.ts` and `admin-settings.ts` in their main sections)
  - `src/import-parser/` (template, workbook reader, limits)
  - `src/runtime/production/`, `src/runtime/navigation.ts`, `src/runtime/config.ts`, `src/runtime/database/client.ts`
  - `src/identity/invitations.ts`, `mail.ts`, `runtime.ts`, `service.ts` (head)
  - `app/szulo/`, `app/admin/` actions and the main pages, `app/teacher/schedule/`, `app/_identity/current-session.ts`, `app/page.tsx`, `app/api/readiness/`, `app/munkatars/beosztas/`
  - `proxy.ts`, `next.config.ts`, `package.json`, `vitest.config.ts`, `playwright.config.ts` (head), `eslint.config.mjs`, `stylelint.config.mjs`, `tsconfig.json`, `.github/workflows/ci.yml`
  - `scripts/db/runner.ts`, `migrate.ts`, `seed/data.ts` (head)
  - `README.md`, `SECURITY.md`, `DESIGN.md` (head), `verification/AUTHORIZATION.md`, `verification/reports/outstanding-targets.md`, `verification/reports/u5-workbook-and-known-limits.md`, `verification/reports/local-acceptance.md` (head)
- **Skimmed only** (noted at file-name or heading level, or sampled):
  - `tests/` (file names, three files sampled)
  - `src/**/*.test.ts`, `scripts/**/*.test.ts` (file names)
  - `src/identity/` other than the files above (`accounts`, `session`, `sign-in`, `reset`, `refresh`, `cookies`, `crypto`, `events`, `copy`, `form-state`, `password`, `admin-client`, `admin-runtime`)
  - `src/runtime/` UI components (`AppShell`, `AppNav`, `StatusBadge` and others)
  - `app/**/_components/` other than `RecordFields`, `TaskFields` (heads), `app/bejelentkezes/`, `app/jelszo-visszaallitas/`, `app/meghivas/`, `app/hozzaferes-megtagadva/`
  - `app/globals.css` (known through `DESIGN.md` and team rules)
  - `scripts/db/` other than the files above, `scripts/verification/`, `scripts/start-smoke.mjs`, `scripts/validate-*`
  - `verification/*.json`, `verification/RUNBOOK.md`
  - `HASZNALATI_UTMUTATO_HU.md` (headings), `source-materials/waldorf-community-app/waldorf-community-task-manager-prd-v1-en.md` (headings), `source-materials/waldorf-community-app/00-index.md`
  - `qa-results/` (file names only)
- **Left out** (not opened):
  - `node_modules/`, `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `.verification/` (build output, dependencies, caches; ignored by `.gitignore`)
  - `.env.example` and every other `.env*` file (privacy instruction of the brief)
  - any `.xlsx` file and anything under `~/Private` (privacy instruction of the brief)
  - `package-lock.json`, `public/brand/`, `app/fonts/` (generated or binary)
  - `.claude/`, `.kiro/`, `.codex/`, `.cursor/`, `.opencode/`, `.aidlc/`, `.aidlc-archive/`, `aidlc/` (other than the record of this intent and its two knowledge documents), `.agents/skills/aidlc*`, `aidlc.settings.json` and the AI-DLC marked section of `AGENTS.md` and `.gitignore` (AI-DLC's own install)

### Packages Found

- `waldorf-community-task-manager` — single private npm package — TypeScript and SQL — Next.js web application over a Supabase (Postgres, sign-in service) backend. No workspaces.
- Internal modules (folders, not packages): `app/` (routes and screens), `src/access`, `src/application`, `src/data`, `src/identity`, `src/import-parser`, `src/runtime`, `scripts/db`, `scripts/verification`, `supabase/migrations`, `tests`.

### Build System

- **Type**: npm 11 scripts over Next.js 16 on Node 24, with TypeScript run directly by Node (`--experimental-strip-types`) for tooling and domain tests.
- **Config Files**: `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `stylelint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `playwright.config.ts`, `supabase/config.toml`, `supabase/roles.sql`.
- **Build Dependencies**: `app` → `src/runtime` → (`src/application`, `src/data`, `src/import-parser`); `src/data` → (`src/application` types, `src/runtime/database`); `src/application` → `src/access`; `proxy.ts` → `src/identity`. Migrations are applied by `scripts/db/runner.ts` in file-name order with checksum tracking.

### APIs Discovered

- HTTP route handlers — `app/api/readiness/route.ts`, `app/munkatars/beosztas/route.ts`, `app/munkatars/beosztas/[id]/route.ts` — 3 GET endpoints.
- Next.js server actions — `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/_identity/actions.ts`, `app/bejelentkezes/actions.ts`, `app/jelszo-visszaallitas/actions.ts`, `app/jelszo-visszaallitas/uj/actions.ts`, `app/meghivas/[token]/actions.ts`.
- Screens — 26 page routes under `/`, `/bejelentkezes`, `/jelszo-visszaallitas`, `/meghivas`, `/hozzaferes-megtagadva`, `/szulo`, `/teacher`, `/admin`.
- Internal TypeScript ports — `ParentApplicationPort`, `AdminApplicationPort` (27 operations), `TeacherApplicationPort`, `AuthorizationVersionPort`, `WorkbookParser`, `DatabaseClient`, `SignInService`, `InvitationMailer`.
- Database functions (data API `rpc`, signed-in) — about 55 granted named functions returning `{state, reference, code}` JSON; system-only functions for the service-role key; no direct table writes for application roles except `notifications.read_at` and `import_staged_rows` delete.

### Frameworks & Libraries

- next — 16.4.2 — web framework (App Router, server actions, `proxy.ts`)
- react, react-dom — 19.2.8 — UI
- @supabase/supabase-js — 2.117.3 — data API client
- @next/env — 16.4.2 — environment files in tooling
- zod — 4.6.7 — runtime configuration validation
- nodemailer — 10.2.1 — invitation email over SMTP
- @e965/xlsx — 0.20.3 — server-side workbook reader
- supabase (CLI) — 2.120.0, dev — local stack, Postgres major 17
- pg — 8.23.1, dev — tooling and database tests
- vitest — 4.1.12, @vitest/coverage-istanbul — 4.1.12, @vitest/coverage-v8 — 4.1.12, dev
- @playwright/test — 1.62.1, @axe-core/playwright — 4.13.0, dev
- stylelint — 18.0.0, stylelint-config-standard — 41.0.0, eslint-config-next — 16.3.8, dev
- typescript — ^5.9.0, @types/node — ^24.0.0, dev
- eslint, prettier, jsdom, @types/react, @types/react-dom, @testing-library/react, @testing-library/jest-dom — `latest`, dev (floating)

### Test Coverage

- **Test Directories**: `src/**/*.test.ts` (Node test runner), `scripts/**/*.test.ts` (Node test runner), `tests/unit`, `tests/integration`, `tests/coverage` (Vitest), `tests/database` (Node test runner against the local stack), `tests/browser` (Playwright: Chromium, Firefox, mobile Chrome, with axe accessibility checks).
- **Test Frameworks**: `node:test`, Vitest with jsdom and Testing Library, Playwright, axe.
- **Coverage Config**: present. Istanbul through Vitest, thresholds 80/80/80 lines, branches, functions, over `app/`, `src/`, `scripts/`, `proxy.ts`, `next.config.ts`; domain coverage also enforced by the Node runner flags.
- Current results were not measured (read-only scan). The last recorded report is bound to an older commit (`8f1cefa`, 33 pass, 0 fail, 6 outstanding), so it is historical.

### Code Quality Indicators

- **Linting**: ESLint (`eslint.config.mjs`, Next rules, zero warnings); Stylelint for `app/globals.css`; Prettier; strict TypeScript. `src/access` is outside the `lint` and `format` paths in `package.json`.
- **CI/CD**: `.github/workflows/ci.yml` (full `verify:local` on pull requests, weekly and on demand; SBOM and unsigned build evidence on `main`). Actions pinned to commit hashes. No deployment workflow, by decision.
- **Documentation**: English `README.md`; Hungarian manual test guide; `DESIGN.md`; verification runbook and reports; SQL files carry detailed comments naming business rules.

### Technical Debt Signals

- No `TODO`, `FIXME`, `HACK`, `eslint-disable` or `ts-ignore` in production code (`app`, `src`, `scripts`, `proxy.ts`, `next.config.ts`).
- **Defect: swap and cancellation reasons are lost.** `app/szulo/actions.ts` lines 33 and 136 require a `reason` field, but neither `requestSwapAction` (lines 39-47) nor `requestCancellationAction` (lines 140-146) passes it to the facade, so `change_requests.reason` stays empty from the screens.
- Contribution note limit differs: the screen and action allow 300 characters (`app/szulo/actions.ts` line 184), the database 500 (`20261026`). The gap analysis says 500.
- Name limit differs: admin actions allow 120 characters for a title (`app/admin/actions.ts` line 32), the database 200.
- Placeholder tables remain: `app_import_runs` is still read by `scope_probe` (`20261033`), although the real table is `import_runs`; `app_audit_events` has no user.
- `organization_settings` has no reader or writer outside schema tests.
- `AccessService` and the in-memory adapters of `src/access/` are used only by tests.
- Function bodies accumulate through `create or replace` and renames: `lifecycle_run` has five definitions across `20261032`, `20261035`, `20261038`, `20261042`, `20261043`, and `identity_housekeeping` four. The current body is found only by reading the latest file.
- Admin reads cap at 1000 rows per table (`src/data/admin-tasks.ts`, `admin-records.ts`) and the task detail page fetches the whole list and filters it (`app/admin/feladatok/[id]/page.tsx` lines 40-43). `duty_list` returns every non-cancelled task of the group, past ones included.
- Dependency versions: seven dev dependencies float on `latest`.
- The local stack runs Postgres 17 (`supabase/config.toml`); the role-migration check uses Postgres 18 tools.
- Non-page export from a page file: `formatBudapestDate` in `app/szulo/feladatok/page.tsx`, imported by other pages.
- Text inside the parent list says "kitalált család" (fictitious family) (`app/szulo/feladatok/page.tsx` line 32), a leftover from the demo era.

## Handoff Summary

- **Intent-relevant finding**: The kindergarten `group` is built into the row-level rules, the tasks and the roles, so moving to a whole community with working groups is the widest change of this intent. `events.group_id` and `tasks.group_id` are `not null` (`20261026` lines 18 and 42); every reach helper (`directory_group_visible`, `has_core_scope`, `coordination_task_reached`) and sign-up eligibility (`duty_sign_up`, `20261028` lines 197-200) go through groups and `group_memberships`. Groups belong to a school year (`20261024` line 41), which fits working groups of a year, but membership is per family and no parent-level or self-service path exists. Parents read no `families`, `parents`, `parent_contacts`, `tasks` or `assignments` of other families at table level (`20261024` lines 275-284, `20261026` lines 196-201), so a directory and a shared rota view need new policies or functions plus a consent column.
- **Other findings later stages need**: `assignments` has only `active`, `swap_pending`, `cancellation_pending`, `removed`, with no done state. `notifications.task_id` is `not null` and `kind` and `target_type` are closed lists (`20261036` lines 82-90), so to-do and library notices need a schema change. Reminder delivery is simulated and runs only when a list is opened (`20261037`, `src/data/notifications.ts`). A database trigger refuses every sign-in email change (`20261022`), so "change my email" needs a sanctioned path that also updates `accounts.email`. The import is tied to a 17-sheet template (`src/import-parser/template.ts`, `sheet_registry`), and invitations have a library but no sending screen (`src/identity/invitations.ts`).
- **Risks / follow-up**: The swap and cancellation reason defect above. Merged migrations are never edited, so the role and group changes must be forward-only migrations applied to `public` and the four worker schemas, with existing data converted. Deadlock safety depends on the fixed lock order (family, then tasks ascending, then assignments ascending), which any bulk rota function must follow. Current test and coverage numbers were not measured. Tests were only sampled.
