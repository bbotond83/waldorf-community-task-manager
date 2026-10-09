# Test Instructions: Visual overhaul, second round

## Setup

- Node 24 and npm 11 must come first on `PATH` (the project refuses Node 26): `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- Dependencies are installed (`node_modules` present). No database or network is needed; the app runs in synthetic mode with fictitious data.
- Test runners already configured: Node's built-in runner (`src/**/*.test.ts`), Vitest with jsdom (`tests/unit`, `tests/integration`, `tests/coverage`), Playwright (`tests/browser`, projects chromium, firefox, mobile-chrome).

## Commands scoped to this change

Run in order, one layer at a time (test-after).

1. Status words (Step 4):
   `node --experimental-strip-types --test src/application/status-labels.test.ts`
   `npx vitest run --config vitest.config.ts tests/integration/admin-components.test.tsx`
2. Menus and landing pages (Step 6):
   `npx vitest run --config vitest.config.ts tests/unit/navigation-access.test.ts tests/unit/current-role-session.test.ts tests/unit/runtime-boundaries.test.ts tests/coverage/app-entrypoints.test.tsx`
3. Shell, menu buttons and focus (Step 8):
   `npx vitest run --config vitest.config.ts tests/integration/runtime-shell.test.tsx tests/integration/app-nav.test.tsx`
4. Whole-card list items (Step 10):
   `npx vitest run --config vitest.config.ts tests/integration/admin-components.test.tsx tests/integration/teacher-components.test.tsx`
5. Notifications (Step 12):
   `npx vitest run --config vitest.config.ts tests/integration/notification-read-form.test.tsx tests/coverage/parent-pages.test.tsx`
6. Production file count (Step 14):
   `npx vitest run --config vitest.config.ts tests/coverage/production-inventory.test.ts`
7. Browser tests (Step 13), after `npm run build`:
   `npx playwright test --config playwright.config.ts tests/browser/navigation-polish.spec.ts tests/browser/runtime-foundation.spec.ts tests/browser/visual-overhaul.spec.ts tests/browser/parent-web.spec.ts tests/browser/teacher-web.spec.ts tests/browser/admin-core.spec.ts --project=chromium --project=mobile-chrome`
   Accessibility only: `npx playwright test --config playwright.config.ts --grep @a11y --project=chromium`

Baseline (Step 2, before any edit): record the pass counts of the Step 2 commands in `code-summary.md`.

## Expected coverage

- At least one happy-path test per new component or helper (`AppNav`, `statusLabel`, the reworked `NotificationReadForm`, the whole-card list items) and one regression per fix: whole-card items for every role, Hungarian status words, default landing page per profile, one menu per profile, notification checkbox, no focus ring on headings.
- The repository-wide floor stays at 80% for lines, branches and functions (checked in Build and Test with `npm run test:coverage`); never lower a threshold to pass.

## Mocking and stubbing

- Page-render tests (`tests/coverage/*.test.tsx`) await the async server component and call `renderToStaticMarkup`; mock `next/headers`, `next/cache` and `next/navigation` the way the existing tests do. `redirect` from `next/navigation` throws; assert on it.
- Component tests (`tests/integration/*.test.tsx`) use `@testing-library/react` with the existing `tests/setup.ts`; mock `usePathname` from `next/navigation` for `AppNav`, and the server action for `NotificationReadForm`.
- Browser tests use the synthetic profiles (`parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local`).

## Test data

Synthetic fixtures only (`src/runtime/synthetic/`, fixture version `waldorf-local-v1`). Assert relations (a card opens its detail page, a list's labels are Hungarian) rather than hard-coded counts where a fixture could change.

## Quality gates run later (Build and Test)

`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, start smoke, `npm run test:browser`, `npm run test:a11y`, `npm run verify:security`.
