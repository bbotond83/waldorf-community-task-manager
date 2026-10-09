# Test Instructions: Functional test fixes

## Setup

- Node 24 and npm 11 must come first on `PATH` (the project refuses Node 26): `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- Dependencies are installed (`node_modules` present). No database or network is needed; the app runs in synthetic mode with fictitious data.
- Test runners already configured: Node's built-in runner (`src/**/*.test.ts`), Vitest with jsdom (`tests/unit`, `tests/integration`, `tests/coverage`), Playwright (`tests/browser`, projects chromium, firefox, mobile-chrome).
- Browser tests run against a production build with the test-mode switch `SYNTHETIC_TEST_COPIES=1` set by `playwright.config.ts`; a dev server started by hand does not have the per-browser copies.

## Commands scoped to this change

Run in order, one layer at a time (test-after).

1. Baseline (Step 2, before any edit): `node --experimental-strip-types --test src/application/status-labels.test.ts` and `npx vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/unit/navigation-access.test.ts tests/integration/app-nav.test.tsx tests/integration/notification-read-form.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/parent-actions.test.ts tests/integration/admin-components.test.tsx`
2. Demo data and helpers (Steps 4 and 6): `node --experimental-strip-types --test src/parent-web/*.test.ts src/application/status-labels.test.ts`
3. Actions (Step 8): `npx vitest run --config vitest.config.ts tests/coverage/parent-actions.test.ts`
4. Parent screens (Step 10): `npx vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/unit/navigation-access.test.ts tests/integration/runtime-shell.test.tsx tests/integration/app-nav.test.tsx tests/integration/notification-read-form.test.tsx tests/integration/parent-components.test.tsx tests/coverage/parent-pages.test.tsx`
5. Admin screens (Step 12): `npx vitest run --config vitest.config.ts tests/integration/admin-components.test.tsx tests/coverage/admin-pages.test.tsx tests/coverage/admin-actions.test.ts`
6. Production file count (Step 14): `npx vitest run --config vitest.config.ts tests/coverage/production-inventory.test.ts`
7. Browser tests (Step 13), after `npm run build`: `npx playwright test --config playwright.config.ts tests/browser/functional-fixes.spec.ts tests/browser/parent-web.spec.ts tests/browser/navigation-polish.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts tests/browser/runtime-foundation.spec.ts --project=chromium --project=firefox --project=mobile-chrome`
   Accessibility only: `npx playwright test --config playwright.config.ts --grep @a11y --project=chromium`

## Expected coverage

- One test per requirement at the narrowest level: helpers (context resolution, pending requests, label map, filter option sets) as Node-runner unit tests; the client components and pages as component or page-render tests; the two journeys and the admin back-link and empty-submit checks as Playwright tests.
- One regression per reported defect: menu stays on Értesítések after opening a notification, opening marks it read, read card greyed, Értesítések first, admin back links, per-list filter options, pending request notice and no duplicate, no test copies and no technical text on normal screens, empty-form messages.
- The repository-wide floor stays at 80% for lines, branches and functions (checked in Build and Test with `npm run test:coverage`); never lower a threshold to pass.

## Mocking and stubbing

- Page-render tests (`tests/coverage/*.test.tsx`) await the async server component and call `renderToStaticMarkup`; mock `next/headers`, `next/cache` and `next/navigation` the way the existing tests do (`redirect` throws; assert on it).
- Component tests (`tests/integration/*.test.tsx`) use `@testing-library/react` with `tests/setup.ts`; mock `usePathname` and `useSearchParams` from `next/navigation` for `AppNav`, and the server actions for `NotificationReadForm` and `MarkNotificationRead`.
- Browser tests use the synthetic profiles (`parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local`) and the per-project suffix helper in `parent-web.spec.ts`.

## Test data

Synthetic fixtures only (`src/parent-web/synthetic-parent.ts`, `src/admin-core/synthetic-admin.ts`, fixture version `waldorf-local-v1`). Assert relations (a card opens its task page, an offered filter value is valid for its list) rather than hard-coded counts where a fixture could change. Per-browser copies exist only with `SYNTHETIC_TEST_COPIES=1`.

## Quality gates run later (Build and Test)

`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, start smoke, `npm run test:browser`, `npm run test:a11y`, `npm run verify:security`.
