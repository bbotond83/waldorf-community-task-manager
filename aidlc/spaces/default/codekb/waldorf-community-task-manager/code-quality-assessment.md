# Code Quality Assessment

## Ratings (good/fair/poor)
Naming clarity good; function size good; error handling good (explicit result states); test presence good; duplication fair (two status-label maps, CSS selectors); dead code fair.

## Testing
71+ test files: node:test domain tests in src/, Vitest (tests/unit, integration, coverage), Playwright specs (admin-core, admin-advanced, parent-web, teacher-web, runtime-foundation, visual-overhaul, navigation-polish, two login specs), database test. 80 percent line/branch/function thresholds. Tests heavily use stable `data-testid` values. Playwright runs chromium, firefox and mobile-chrome against one shared in-memory server state.

## Tests touching this intent's areas (will need updates)
- Parent notifications: tests/browser/parent-web.spec.ts:104-140 (link href `/szulo/feladatok/<duty>` with `projectSuffix`, checkbox read flow), tests/browser/navigation-polish.spec.ts:175-210 (card link count, checkbox size, read state, focus; uses notice-24-hour because state is shared), tests/integration/notification-read-form.test.tsx, tests/coverage/parent-pages.test.tsx:182-190, tests/coverage/parent-actions.test.ts.
- Menu order and current item: tests/unit/runtime-boundaries.test.ts:34-35 (ids in order), tests/integration/runtime-shell.test.tsx:49-100, tests/integration/app-nav.test.tsx (currentNavigationId, BackToHomeLink), tests/unit/navigation-access.test.ts, tests/browser/support/profile-login-measurement.ts:25,45,155.
- Admin lists/filters/forms: tests/browser/navigation-polish.spec.ts:160-171 (exact filter options), tests/browser/admin-core.spec.ts, admin-advanced.spec.ts:79 ("corr-lampas-01"), tests/integration/admin-components.test.tsx, admin-advanced-components.test.tsx, tests/coverage/admin-pages.test.tsx, admin-actions.test.ts, admin-dashboard.test.tsx, src/application/status-labels.test.ts.
- Per-browser demo data: parent-web.spec.ts `projectSuffix` (:4-8, :57, :83, :94, :109-111) depends on the "-firefox" / "-mobile" fixtures.

## Tooling and CI
ESLint max-warnings 0 over app, src/application, src/runtime, tests, scripts; Prettier check; typecheck; CI runs `verify:local` (type check, tests, build, start smoke, browser, a11y, scans). Accessibility: axe tests (`@a11y`).

## Technical debt
- Parent duty state labels duplicated page-locally (app/szulo/feladatok/page.tsx:5-12) and differing from `STATUS_LABELS`.
- Admin filter options are one fixed list for all pages regardless of the list's real state values.
- Notification read state has no revalidation after the action; page text is server-rendered.
- Notification and duty back/current-menu context is path-only; the duty detail back link always targets the duties list.
- Duty detail shows request links regardless of pending state and shows no state.
- Test scenario controls and technical values (scenario selects, "Verzió", "Korreláció", "OUTSTANDING") are rendered as normal user UI.
- Demo fixtures carry test-runner wording ("– Firefox próba", "– mobil próba") visible to users.
- Admin pages repeat their header markup; no back-navigation affordance in admin.
- `autoFocus` headings on several pages; `latest` dependency ranges; large single stylesheet; ESLint scope excludes most of src/.
- No TODO/FIXME or eslint-disable inventory was performed beyond files read.
