## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `app/` (global CSS `app/globals.css`, root layout `app/layout.tsx`, entry `app/page.tsx`, `app/belepes/`, `app/szulo/`, `app/admin/`, `app/teacher/`, `app/munkatars/`, `app/api/`, `app/meghivas/`, `app/hozzaferes-megtagadva/`)
  - `src/runtime/` (AppShell, ProfileSelector, synthetic profiles, session, composition)
  - `src/application/` and `src/admin-core/` (contracts, facades, dashboard and list queries)
  - `proxy.ts`, `next.config.ts`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
  - `tests/browser/`, `tests/integration/runtime-shell.test.tsx`, `tests/coverage/` (grep and targeted reads)
- **Skimmed only** (directory granularity, structure and public surface only):
  - `src/access/`, `src/admin-advanced/`, `src/admin-experience/`, `src/coordination/`, `src/directory/`, `src/import-migration/`, `src/notifications/`, `src/parent-experience/`, `src/parent-web/`, `src/privacy-audit/`, `src/teacher-tracking/`, `src/teacher-web/`
  - `scripts/`, `supabase/migrations/`, `verification/`, `qa-results/`, `source-materials/`, `tests/unit/`, `tests/database/`, `README.md`, `HASZNALATI_UTMUTATO_HU.md`
- **Left out**: `node_modules/`, `.next/`, `coverage/`, `test-results/`, `tsconfig.tsbuildinfo`, `.verification/`, `public/brand/` image binaries (not opened by instruction), `.aidlc-archive/`, and AI-DLC install directories (`.claude/`, `.codex/`, `.agents/`, `aidlc/`).

### Packages Found
- waldorf-community-task-manager — single npm package (no workspaces) — TypeScript/React — Next.js 16 App Router web app with domain modules under `src/` and routes under `app/`.

### Build System
- **Type**: npm scripts around Next.js 16 (`next build`/`next start`); Node 24 pinned by `.nvmrc` and `engines`.
- **Config Files**: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, `playwright.config.ts`, `playwright.login-*.config.ts`, `proxy.ts`.
- **Build Dependencies**: `prebuild`/`prestart`/`predev` run `scripts/validate-toolchain.mjs` and `scripts/validate-runtime-config.ts`; `verify:local` orchestrates the full pipeline.

### APIs Discovered
- Route handlers — `app/api/readiness/route.ts` (GET), `app/api/synthetic/session/route.ts` (POST, profile switch/clear), `app/api/synthetic/reset/route.ts`, `app/munkatars/beosztas/route.ts` and `app/munkatars/beosztas/[id]/route.ts` (legacy GET 307 redirects to `/teacher/schedule`) — 5 handlers.
- Server Actions — `app/belepes/actions.ts`, `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/meghivas/[token]/actions.ts`.

### Frameworks & Libraries
- next 16.4.0 — App Router, SSR, `next/link`, `proxy.ts` (nonce CSP).
- react / react-dom 19.2.8 — UI (declared `latest`).
- zod 4.4.3 — validation of profile IDs, session payloads.
- vitest 4.1.11, @testing-library/react, jsdom — unit/integration/coverage tests.
- @playwright/test 1.62.1, @axe-core/playwright 4.13.0 — browser and accessibility tests.
- eslint 9.39.5 (+ eslint-config-next), prettier 3.9.6, typescript 5.9.3.

### Test Coverage
- **Test Directories**: `tests/unit`, `tests/integration`, `tests/coverage`, `tests/browser`, `tests/database`, colocated `src/**/*.test.ts`.
- **Test Frameworks**: node:test (domain, `npm run test:domain`), Vitest + jsdom (delivery), Playwright (chromium, firefox, mobile-chrome Pixel 7; ports 3100-3102).
- **Coverage Config**: present; 80% lines/branches/functions thresholds in `vitest.config.ts` and domain coverage script.

### Code Quality Indicators
- **Linting**: ESLint flat config with `eslint-config-next` core-web-vitals + typescript, `--max-warnings=0`; Prettier (printWidth 100, double quotes, trailing commas).
- **CI/CD**: `.github/workflows/ci.yml` (validate job runs `npm run verify:local`; SBOM/build-evidence job; actions pinned to SHAs). No deploy workflow.
- **Documentation**: `README.md`, Hungarian user guide `HASZNALATI_UTMUTATO_HU.md`, `verification/RUNBOOK.md`.

### Technical Debt Signals
- Runtime dependencies pinned to `latest` for react, react-dom, zod and most dev tools (`package.json`) with only the lockfile fixing versions.
- Styling is one 857-line global stylesheet `app/globals.css` with per-area class families (`admin-*`, `parent-*`, `teacher-*`, `advanced-*`), literal hex colours reused outside the token set (`#eef6fb`, `#fff1ed`) and `rgb(...)` literals in `body`/`--shadow`; no font loading, system font stack only.
- `overflow-wrap: anywhere` on `h1, h2, p` (`app/globals.css:116-120`) breaks long words at arbitrary points without hyphens; no `hyphens`/`lang`-aware rule anywhere.
- `lint`/`format` scripts cover only `app src/application src/runtime tests scripts *.config.* proxy.ts`; other `src/*` domain folders are not linted.
- Dashboard cards (`app/admin/page.tsx`) are plain `<section>` panels with no navigation; "Részletek" links are duplicated in `ResponsiveCollection.tsx` (admin) and `app/szulo/feladatok/page.tsx` (parent).
- `public/` (including `public/brand/`) is untracked in git at scan time.

## Handoff Summary
- **Intent-relevant finding**:
  1. Styling: single global stylesheet `app/globals.css` with `:root` tokens (`--color-background #f7f2e8`, `--color-primary #8c3f2f`, `--color-focus #165d8f`, etc., lines 1-20), imported only from `app/layout.tsx:3`; root `<html lang="hu">` already set at `app/layout.tsx:12` so CSS `hyphens: auto` will use Hungarian dictionaries in browsers that support `hu`; no `hyphens` property exists and `overflow-wrap: anywhere` (lines 116-120) forces mid-word breaks. Role labels are plain strings in `src/runtime/synthetic/profiles.ts:52-81` ("Csoportadminisztrátor", "Szuperadminisztrátor") rendered in `<h2>` in `src/runtime/ProfileSelector.tsx:17`, `<strong>` in `src/runtime/AppShell.tsx:20`, status text `AppShell.tsx:64`, and the greeting in `app/page.tsx:37-39`.
  2. Chooser: `src/runtime/ProfileSelector.tsx:16-34` renders one `<article.profile-card>` per profile with a POST `<form action="/api/synthetic/session">`, hidden `profileId` input and a `<button type="submit">Profil használata</button>` (`data-testid=profile-selector-<id>-button`). The route `app/api/synthetic/session/route.ts` consumes `profileId` and redirects 303 to `/`. Tests asserting on the button: `tests/integration/runtime-shell.test.tsx:12,13,61,91` (role button name "Profil használata", four of them), and Playwright `tests/browser/{teacher-web,admin-core,parent-web,runtime-foundation,admin-advanced}.spec.ts` plus `tests/browser/support/profile-login-measurement.ts:110`, all clicking `profile-selector-<id>-button`. `AppShell.tsx` "Tesztprofil váltása" button posts `profileId=""`. `HASZNALATI_UTMUTATO_HU.md:26` also names "Profil használata".
  3. Parent list: `app/szulo/feladatok/page.tsx:58-70` renders `<li.parent-card data-testid=duty-card-<id>>` with an `<a data-testid=duty-open-<id>>Részletek</a>` preserving the `?allapot=` filter; used by `tests/browser/parent-web.spec.ts:62-63`. `HASZNALATI_UTMUTATO_HU.md:97` mentions "Részletek". Admin list pages reuse the same text via `app/admin/_components/ResponsiveCollection.tsx:19-25` (out of the stated scope but shares wording).
  4. Admin overview: `app/admin/page.tsx:36-75` renders four non-interactive `DashboardPanel` sections (`admin-dashboard-approvals`, `-records`, `-tasks`, `-queue`) with counts. Matching list routes: `/admin/jovahagyasok`, `/admin/nyilvantartasok`, `/admin/feladatok`; list pages filter by `?q=` and `?state=` (values `active|archived|open|pending`, `AdminFilterBar.tsx`); `src/admin-core/synthetic-admin.ts:196-214` counts "open approvals" as `state === "pending"`, so the matching destination for the approvals/queue cards is `/admin/jovahagyasok?state=pending`. Tests: `tests/browser/admin-core.spec.ts:32`, `admin-advanced.spec.ts:97,114`, `profile-login-measurement.ts:28,58-61` depend on the dashboard test IDs; keep them. `app/munkatars/` contains only legacy redirect route handlers, no pages; teacher UI is under `app/teacher/`.
  5. Shared chrome: `src/runtime/AppShell.tsx` (skip link, `.site-header`, `<details.navigation-panel>`, `<main id="fo-tartalom">`) wraps every role via `app/{szulo,admin,teacher}/layout.tsx`; the logo/cover would be added in `AppShell.tsx` and `ProfileSelector.tsx`. `proxy.ts` CSP: `img-src 'self' blob: data:` (allows `/brand/*`), `font-src 'self'` and `style-src 'self' 'unsafe-inline'` (external Google Fonts blocked; `next/font` self-hosting or local files only).
- **Risks / follow-up**:
  - `@a11y` Playwright tests run axe on the root flow and role areas (`tests/browser/runtime-foundation.spec.ts:32`, `admin-core.spec.ts:95`, `admin-advanced.spec.ts:157`, `teacher-web.spec.ts:130`); new colours must keep contrast, and whole-card links need a single accessible name and no nested interactive elements (the card contains a form/hidden input; the parent card contains badge text).
  - Making the chooser card the button changes the accessible name from "Profil használata" to the card content; unit tests (`runtime-shell.test.tsx`) and the user guide require updates, and stable `data-testid` hooks should be preserved.
  - `app/globals.css` colour literals are not all tokenised; a palette swap must touch the literal hex values at lines 329, 334, 461, 467, 600, 787 (`#eef6fb`, `#fff1ed`) too.
  - Coverage gate is 80% on all production source; any new component or helper needs tests (the `production-inventory` test enumerates production files).
  - `public/` is untracked; images must be committed for builds/CI.
  - Lint/format scripts cover only a subset of `src/`; new files under `app/` and `src/runtime/` are covered.
