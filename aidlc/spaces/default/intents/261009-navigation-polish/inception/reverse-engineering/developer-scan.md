## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - ./app/ (all route pages, layouts, `_components`, `_lib`, server actions, `api/`, `globals.css` selectors relevant to navigation, cards, focus and notifications)
  - ./src/runtime/ (AppShell, BrandMark, ProfileSelector, composition, session, synthetic profiles)
  - ./src/application/ (authorization matrix and navigation, contracts)
  - ./tests/ (browser, integration, coverage, unit specs that touch navigation, list items, landing page, notifications)
  - ./package.json, ./vitest.config.ts, ./playwright.config.ts, ./next.config.ts, ./proxy.ts, ./.github/workflows/ci.yml, ./.env.example
- **Skimmed only**:
  - ./src/access/, ./src/admin-core/, ./src/admin-advanced/, ./src/admin-experience/, ./src/coordination/, ./src/directory/, ./src/import-migration/, ./src/notifications/, ./src/parent-experience/, ./src/parent-web/, ./src/privacy-audit/, ./src/teacher-tracking/, ./src/teacher-web/ (only state values, link values and exported shapes read)
  - ./scripts/, ./verification/, ./supabase/, ./qa-results/, ./source-materials/, ./tests/database/, ./README.md, ./HASZNALATI_UTMUTATO_HU.md, ./AGENTS.md
- **Left out**: ./node_modules/, ./.next/, coverage and build output, ./public/brand/ images (not opened by instruction), AI-DLC install and workspace (.claude/, .kiro/, .codex/, .cursor/, .opencode/, .aidlc/, .agents/, .aidlc-archive/, aidlc/ except the existing codekb for reference), aidlc-named files under .github/.

### Packages Found
- waldorf-community-task-manager (v0.2.0) — single npm package, Next.js app plus domain modules — TypeScript (ESM) — Hungarian role-based community task manager (synthetic runtime for local use, production adapter slot not wired)

### Build System
- **Type**: npm 11 / Node 24 (`.nvmrc`, `engines`), Next.js 16.4.0 build (`next build`), `tsc --noEmit`
- **Config Files**: package.json, tsconfig.json, next.config.ts, proxy.ts (CSP middleware), eslint.config.mjs, .prettierrc.json, vitest.config.ts, playwright.config.ts (+ two login configs), .github/workflows/ci.yml
- **Build Dependencies**: app/ imports src/* modules by relative path; no workspaces

### APIs Discovered
- Next.js route handlers — app/api/synthetic/session (POST), app/api/synthetic/reset, app/api/readiness (GET), app/munkatars/beosztas (+ /[id]) route handlers — 5 handlers
- Server actions — app/admin/actions.ts, app/admin/advanced-actions.ts, app/szulo/actions.ts (incl. `markNotificationReadAction`), app/belepes/actions.ts, app/meghivas/[token]/actions.ts

### Frameworks & Libraries
- next 16.4.0 — app router, server components, server actions
- react / react-dom "latest" — UI (unpinned)
- zod "latest" — validation
- vitest 4.1.11 + jsdom + Testing Library, Playwright + axe-core, node:test for src/**/*.test.ts

### Test Coverage
- **Test Directories**: tests/unit, tests/integration, tests/coverage, tests/browser, tests/database; colocated src/**/*.test.ts
- **Test Frameworks**: node:test (domain), Vitest (delivery), Playwright (chromium, firefox, mobile-chrome)
- **Coverage Config**: present (istanbul, 80% lines/branches/functions thresholds in vitest.config.ts; node test coverage flags in package.json)

### Code Quality Indicators
- **Linting**: ESLint (eslint.config.mjs, `--max-warnings=0`), Prettier (.prettierrc.json) — lint scope limited to app, src/application, src/runtime, tests, scripts
- **CI/CD**: .github/workflows/ci.yml (validate, SBOM/build evidence); deployment workflows intentionally absent
- **Documentation**: README.md, Hungarian user guide, verification/RUNBOOK.md; sparse doc comments in code

### Technical Debt Signals
- Navigation is defined in three places (see Handoff) and the admin layout rewrites the profile nav at request time: app/admin/_lib/session.ts:76-88
- Raw English state values rendered unlocalized: app/admin/_components/ResponsiveCollection.tsx:15; detail pages app/admin/nyilvantartasok/[id]/page.tsx:32, app/admin/archivum/[id]/page.tsx:38, app/admin/jovahagyasok/[id]/page.tsx:47, app/admin/feladatok/[id]/page.tsx:46; reminders `job.status` app/admin/emlekeztetok/page.tsx:55; privacy `candidate.eligibility` app/admin/adatvedelem/page.tsx:40
- `autoFocus` + `tabIndex={-1}` on page headings in 8 pages plus the global `:focus-visible` rule: app/globals.css:75
- Unpinned `latest` for react, react-dom, zod and several dev dependencies in package.json
- app/globals.css is a single 1000-line file with duplicated selectors (`.home-panel` x4, `.parent-card` x3)

## Handoff Summary
- **Intent-relevant finding**: Navigation sources and landing behavior.
  1. Nav lists: `src/runtime/synthetic/profiles.ts:25-47` (parent 2, teacher 1, group admin 3, super admin 8; used on `/` home page and by parent/teacher layouts), `app/admin/_lib/session.ts:76-88` `withCoreNavigation` (5 core items with "Feladatok és események" and Archívum, then appends profile items not already core, giving 5 for group admin, 9 for super admin; used only by `app/admin/layout.tsx:16`), and `src/application/authorization.ts:46-114` matrix rows plus `navigation()` at :164-196 (one item per row, `HOME_PATH_BY_ROLE` at :117-122; consumed by the session facade, not by AppShell).
  2. AppShell (`src/runtime/AppShell.tsx:11-72`) takes `profile` and renders `profile.navigation` inside a `<details open>` with `<nav aria-label="Fő navigáció">` (lines 49-62) and test ids `app-shell-navigation-<id>`; layouts: `app/admin/layout.tsx:16`, `app/szulo/layout.tsx:11`, `app/teacher/layout.tsx:13`, and `app/page.tsx:32`. The nav styles are the global `nav ul`/`nav a`/`nav a:hover` at `app/globals.css:292-310` plus mobile overrides at :952-966.
  3. Landing: `app/api/synthetic/session/route.ts:33,46-52` always redirects (303) to `/`; `app/page.tsx:31-43` renders the welcome panel with `<h1 tabIndex={-1} autoFocus>` (line 35). `profile.homePath` exists (profiles.ts:56,65,74,83) but parent is `/szulo/feladatok` (intent wants `/szulo/ertesitesek`); `HOME_PATH_BY_ROLE` (authorization.ts:117) has the same parent value; `app/belepes/actions.ts:53` defaults to `/szulo/feladatok`; `tests/unit/current-role-session.test.ts:43` asserts the teacher home path.
  4. "Részletek" links: `app/admin/_components/ResponsiveCollection.tsx:17-22` (shared by archivum, jovahagyasok, nyilvantartasok, feladatok pages, test id `<testId>-open-<id>`), `app/teacher/schedule/_components/ScheduleCollection.tsx:48-53` (table cell, test id `teacher-schedule-open-<id>`), :87-92 (card, `teacher-schedule-card-open-<id>`), plus a visually hidden "Részletek" column header :27-29. "Megnyitás" link: `app/szulo/ertesitesek/page.tsx:51-53` (`notification-link-<id>`). Whole-card pattern already used by `app/szulo/feladatok/page.tsx:58-68` (`.parent-card-link`, css :688-706) and `app/admin/page.tsx` DashboardPanel (`<a class="dashboard-link">`).
  5. Notifications: `app/szulo/ertesitesek/page.tsx:39-56` card; mark-as-read is `app/szulo/_components/NotificationReadForm.tsx` (client form, `useActionState`, button label "Olvasottnak jelölöm", test ids `notification-read-form|button|state-<id>`) calling `markNotificationReadAction` at `app/szulo/actions.ts:70-92`, which returns `link` of the notification. Text-alignment cause: `.parent-card { padding: 0 }` (globals.css:681-686) was set for `.parent-card-link` cards, but notification cards have no inner link, so their `<div>` children sit flush against the border.
  6. Raw state: `AdminItemModel.state` is `string` (src/application/contracts.ts:183-188); synthetic values active, archived, open, scheduled, pending, approved (src/admin-core/synthetic-admin.ts:33-127); no admin label map exists. Existing Hungarian maps: `STATE_LABELS` in app/szulo/feladatok/page.tsx:5-12, `TIMING_LABEL`/`PROVIDER_LABEL` in app/szulo/ertesitesek/page.tsx:6-18, `<option>` labels in `AdminFilterBar.tsx:24-28` and reminders filter. Teacher `currentStatusLabel` is already Hungarian data (Ütemezett, Nyitott).
  7. Focus: autoFocus h1 in app/page.tsx:35, szulo/feladatok:32, admin/page.tsx:28, admin/beallitasok:21, admin/adatvedelem:25, admin/emlekeztetok:25, admin/import:22, teacher/schedule:33, teacher/schedule/[id]:56, teacher/_components/TeacherAccessState.tsx:10. Global `:focus-visible` (globals.css:75-78, colour `--color-focus: #1f4e79` :14) paints the blue rectangle.
  8. Tests that will need updating: tests/integration/admin-components.test.tsx:82-90 (asserts `records-open-*` href and text "active"), tests/browser/admin-core.spec.ts:85 ("Állapot: archived"), tests/browser/teacher-web.spec.ts:48-49,150 (open test ids), tests/browser/parent-web.spec.ts:112-117 (`notification-read-button-*`), tests/browser/runtime-foundation.spec.ts:15,23 (`toBeFocused` on "Üdvözlünk" heading), tests/browser/visual-overhaul.spec.ts:48,54,63,112 and tests/browser/support/profile-login-measurement.ts:17,36,116-118 (greeting heading, `homePath` URL, click on home nav item), tests/browser/admin-core.spec.ts:30 (`toBeFocused` on "Áttekintés"), tests/coverage/app-entrypoints.test.tsx:25-33,70-76 (home renders "Üdvözlünk" and nav hrefs), tests/integration/runtime-shell.test.tsx:49-100 (nav links, teacher nav), tests/unit/runtime-boundaries.test.ts:209-213 (group admin nav excludes import/settings), tests/coverage/parent-pages.test.tsx:56-68 (parent whole-card test, "Részletek" absent), tests/browser/profile-login-*.spec.ts (nav item counts `app-shell-navigation-<id>`, `permittedNavigationIds` adds admin-records, admin-archive).
- **Risks / follow-up**: Removing the home page for signed-in users breaks every test that expects the "Üdvözlünk" heading after profile selection; the teacher nav test ids and the hidden-menu requirement conflict with `assertProfileMainReady` (expects all nav items visible). Group admin must keep import/reminders/settings/privacy out of navigation (also enforced server-side by authorization matrix and `app/admin/import/layout.tsx`). Notification link target `/szulo/ertesitesek` (synthetic-parent.ts:145) can point back to the list itself. Keep `data-testid` stability or update specs together. All user-facing copy stays Hungarian.
