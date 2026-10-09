# Code Quality Assessment

## Ratings (good/fair/poor)
Naming clarity good; function size good; error handling good (explicit result states); test presence good; duplication fair (CSS selectors, three nav lists); dead code fair.

## Testing
71 test files: node:test domain tests in src/, Vitest (tests/unit, integration, coverage), Playwright specs (admin-core, admin-advanced, parent-web, teacher-web, runtime-foundation, visual-overhaul, two login specs), database test. 80 percent line/branch/function thresholds. Tests heavily use stable `data-testid` values.

## Tests touching intent areas (will need updates)
- Nav labels/counts: tests/integration/runtime-shell.test.tsx:49-100; tests/unit/runtime-boundaries.test.ts:209-213; tests/browser/admin-core.spec.ts:33-34; admin-advanced.spec.ts:28-33,114; profile-login-existing/performance specs and support/profile-login-measurement.ts:36-43,116-118,159-161 (`permittedNavigationIds` adds admin-records, admin-archive).
- Landing "Üdvözlünk": tests/browser/runtime-foundation.spec.ts:15,23,27; visual-overhaul.spec.ts:48,54,63,112; profile-login-measurement.ts:17,116; tests/coverage/app-entrypoints.test.tsx:25-33,70-76; focus assertions `toBeFocused` runtime-foundation.spec.ts:15,23 and admin-core.spec.ts:30.
- "Részletek"/open links: tests/integration/admin-components.test.tsx:82-90; tests/browser/teacher-web.spec.ts:48-49,150; tests/coverage/parent-pages.test.tsx:56-68 (asserts absence on duties).
- Raw state text: admin-components.test.tsx:88 ("active"), admin-core.spec.ts:85 ("Állapot: archived"), tests/coverage/admin-dashboard.test.tsx:75 (`state: "pending"` query).
- Notifications: tests/browser/parent-web.spec.ts:112-117; tests/coverage/parent-pages.test.tsx:182-190.

## Tooling and CI
ESLint max-warnings 0 over app, src/application, src/runtime, tests, scripts; Prettier check; typecheck; CI runs `verify:local` (type check, tests, build, start smoke, browser, a11y, scans). Accessibility: axe test `@a11y` on root flow.

## Technical debt
- Duplicated/inconsistent navigation (see architecture.md); duplicated home path constant.
- Unlocalized state values in admin lists and detail pages, reminders, privacy lifecycle; no shared label map.
- `autoFocus` headings with `tabIndex=-1` on ten pages and a global `:focus-visible` outline using `--color-focus` produce a visible box on every programmatic focus.
- Notification cards: padding reset (globals.css:681-686) shared with link cards leaves content flush with the border.
- `latest` dependency ranges; single large stylesheet with repeated selectors; ESLint scope excludes most of src/.
- No TODO/FIXME or eslint-disable inventory was performed beyond files read.
