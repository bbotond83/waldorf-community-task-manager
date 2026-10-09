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

## Tests touching the admin list polish areas (will need updates)
- Teacher filter and clear: tests/integration/teacher-components.test.tsx:42-92, tests/browser/teacher-web.spec.ts:25-75 (filter submit, from-input value after the back link, empty-state clear link), tests/unit/teacher-filters.test.ts (default dates), tests/coverage/teacher-pages.test.tsx.
- Admin filters and status text: tests/integration/admin-components.test.tsx:172-225 (option text), tests/coverage/admin-functional-fixes.test.tsx:90-125, tests/browser/navigation-polish.spec.ts:155-171, tests/browser/functional-fixes.spec.ts:215-290 (exact option labels, `selectOption({label})`), tests/browser/admin-core.spec.ts:76 and navigation-polish.spec.ts:151 (`.admin-state-badge` selector), src/application/status-labels.test.ts, tests/unit/design-tokens.test.ts (contrast of any new colour token; hex only in `:root`).
- "rekord" wording: tests/coverage/admin-pages.test.tsx:82 ("rekord részletei") and tests/browser/admin-advanced.spec.ts:55 ("3 rekord"); the create links and forms are matched by test id only.
- User guide HASZNALATI_UTMUTATO_HU.md lines 126-131, 150-156, 186-187, 207, 221, 273-281.

## Tooling and CI
ESLint max-warnings 0 over app, src/application, src/runtime, tests, scripts; Prettier check; typecheck; CI runs `verify:local` (type check, tests, build, start smoke, browser, a11y, scans). Accessibility: axe tests (`@a11y`).

## Technical debt
- Parent duty labels now come from the shared `DUTY_STATE_LABELS` (the page-local map is gone); `STATUS_LABELS` and `DUTY_STATE_LABELS` are still two maps, and the teacher status column uses unmapped free text (`currentStatusLabel`).
- Filter forms (teacher, admin, parent) are uncontrolled, unkeyed and have no common component; teacher "clear" resets to hard-coded defaults, admin and parent filters have no clear control; the admin pagination is a static placeholder.
- Filter layouts are separate CSS grids with flat label/control siblings (`.admin-filter`, `.teacher-filter fieldset`), which wrap unevenly.
- Status text has no symbol or colour cue and no shared badge component.
- Admin filter options are per list at HEAD (`ADMIN_LIST_STATUS_OPTIONS`).
- Notification read state is revalidated by the action (fixed since the earlier store); `NotificationReadForm` focus handling depends on the card being an `li` with a sibling link, and a read box cannot be unticked.
- Notification context for the menu and the duty back link depends solely on the `ertesites` query parameter (validated server-side in the duty page; the request pages ignore it and always link back to the task).
- Duty detail now shows state and hides request links while a request is pending (fixed since the earlier store).
- Deep scan 2026-10-09 (shell, menu, parent screens): `AppShell` carries demo copy on every screen ("Tesztprofil váltása", profile `scopeSummary` with "kitalált"); the `?scenario=` selector on csere/lemondas pages and `p.synthetic-label` text ("Szimulált szolgáltató", "OUTSTANDING" on the admin reminders page and the import outcome) are still visible UI; each admin page re-resolves the session; `ParentMutationForm` and `AdminMutationForm` duplicate the state-region logic (separate action-state types); `DutyDetailPage` imports `formatBudapestDate` from a sibling page module (page-to-page import).
- Test coverage for the shell and parent screens (read in this run): app-nav.test.tsx (menu, current item, BackToHomeLink), runtime-shell.test.tsx (shell, chooser, parent and teacher projections), notification-read-form.test.tsx, mark-notification-read.test.tsx, parent-pages.test.tsx (all duty states, notifications), current-role-session.test.ts and app-session-boundaries.test.ts (sessions), admin-components.test.tsx:249+ (AdminMutationForm). No dedicated test for `ParentMutationForm`/`PendingRequestPanel` beyond parent-components.test.tsx and the browser specs, none for the teacher "Szűrők törlése" stale-value behavior (teacher-components.test.tsx only checks the link exists and href).
- Test scenario controls and technical values (scenario selects, "Verzió", "Korreláció", "OUTSTANDING") are rendered as normal user UI.
- Demo fixtures carry test-runner wording ("– Firefox próba", "– mobil próba") visible to users.
- Admin pages repeat their header markup; no back-navigation affordance in admin.
- `autoFocus` headings on several pages; `latest` dependency ranges; large single stylesheet; ESLint scope excludes most of src/.
- No TODO/FIXME or eslint-disable inventory was performed beyond files read.
