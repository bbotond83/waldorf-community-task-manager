# Test Instructions: Admin and schedule list polish

## Setup

- Node 24 and npm 11 must come first on `PATH` (the project refuses Node 26): `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- Dependencies are installed (`node_modules` present). No database or network is needed; the app runs in synthetic mode with fictitious data.
- Test runners already configured: Node's built-in runner (`src/**/*.test.ts`), Vitest with jsdom (`tests/unit`, `tests/integration`, `tests/coverage`), Playwright (`tests/browser`, projects chromium, firefox, mobile-chrome).
- Browser tests run against a production build; `playwright.config.ts` starts three servers (ports 3100 to 3102) with `SYNTHETIC_TEST_COPIES=1`.

## Commands scoped to this change

Run in order, one layer at a time (test-after).

1. Baseline (Step 2, before any edit): `node --experimental-strip-types --test src/application/status-labels.test.ts` and `npx vitest run --config vitest.config.ts tests/unit/teacher-filters.test.ts tests/integration/teacher-components.test.tsx tests/integration/admin-components.test.tsx tests/coverage/teacher-pages.test.tsx tests/coverage/admin-pages.test.tsx tests/coverage/admin-functional-fixes.test.tsx tests/unit/design-tokens.test.ts`
2. Business logic (Steps 3 and 4): `node --experimental-strip-types --test src/application/status-labels.test.ts src/application/status-symbols.test.ts` and `npx vitest run --config vitest.config.ts tests/unit/teacher-filters.test.ts`
3. Frontend (Step 7): `npx vitest run --config vitest.config.ts tests/integration/status-badge.test.tsx tests/integration/admin-components.test.tsx tests/integration/teacher-components.test.tsx tests/integration/parent-components.test.tsx tests/coverage/teacher-pages.test.tsx tests/coverage/admin-pages.test.tsx tests/coverage/admin-functional-fixes.test.tsx tests/coverage/parent-pages.test.tsx tests/unit/design-tokens.test.ts`
4. Production file count (Step 9): `npx vitest run --config vitest.config.ts tests/coverage/production-inventory.test.ts`
5. Browser tests (Step 8), after `npm run build`: `npx playwright test --config playwright.config.ts tests/browser/list-polish.spec.ts tests/browser/teacher-web.spec.ts tests/browser/navigation-polish.spec.ts tests/browser/functional-fixes.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts tests/browser/parent-web.spec.ts --project=chromium --project=firefox --project=mobile-chrome`
   Accessibility only: `npx playwright test --config playwright.config.ts --grep @a11y --project=chromium`

## Expected coverage

- One test per requirement at the narrowest level: teacher filter semantics, symbol table and teacher status mapping as Node-runner and Vitest unit tests; status badge, clear controls, option texts and create buttons as component or page-render tests; the clear journeys, label layout at 320 px and desktop, and symbols in the accessibility tree as Playwright tests.
- One regression per reported defect: clear empties every field (teacher and the three admin lists, including stale typed values and address-supplied values), label-above-field layout, both create entry points are buttons, "elem" wording, a symbol before every status word.
- The repository-wide floor stays at 80% for lines, branches and functions (checked in Build and Test with `npm run test:coverage`); never lower a threshold to pass.

## Mocking and stubbing

- Page-render tests (`tests/coverage/*.test.tsx`) await the async server component and call `renderToStaticMarkup`; mock `next/headers`, `next/cache` and `next/navigation` the way the existing tests do (`redirect` throws; assert on it).
- Component tests (`tests/integration/*.test.tsx`) use `@testing-library/react` with `tests/setup.ts`.
- Browser tests use the synthetic profiles (`parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local`) and reset the synthetic state through `/api/synthetic/reset` before each journey.

## Test data

Synthetic fixtures only (`waldorf-local-v1`). Assert relations (every label key has a symbol, a clear control empties every field) rather than hard-coded counts where a fixture could change.

## Quality gates run later (Build and Test)

`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, start smoke, `npm run test:browser`, `npm run test:a11y`, `npm run verify:security`, plus the case-insensitive `rekord` search over `app/`, `src/`, tests and the user guide.
