# Test Instructions: Visual overhaul and UX fixes

## Setup

- Node 24 and npm 11 must come first on `PATH` (the project refuses Node 26): `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- Dependencies are installed (`node_modules` present). No database or network is needed; the app runs in synthetic mode with fictitious data.
- Test runners already configured: Node's built-in runner (`src/**/*.test.ts`), Vitest with jsdom (`tests/unit`, `tests/integration`, `tests/coverage`), Playwright (`tests/browser`, three projects: chromium, firefox, mobile-chrome).

## Commands scoped to this change

Run these in order, one layer at a time (test-after).

1. Design tokens (Step 4):
   `npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts`
2. Role-name syllable breaks (Step 6):
   `node --experimental-strip-types --test src/runtime/hyphenation.test.ts`
3. Branding and profile chooser (Step 8):
   `npx vitest run --config vitest.config.ts tests/integration/runtime-shell.test.tsx tests/coverage/app-entrypoints.test.tsx`
4. Parent task list (Step 10):
   `npx vitest run --config vitest.config.ts tests/coverage/parent-pages.test.tsx`
5. Admin overview (Step 12):
   `npx vitest run --config vitest.config.ts tests/coverage/admin-dashboard.test.tsx tests/coverage/admin-pages.test.tsx`
6. Production file count (Step 14):
   `npx vitest run --config vitest.config.ts tests/coverage/production-inventory.test.ts`
7. Browser tests (Step 13), after `npm run build`:
   `npx playwright test --config playwright.config.ts tests/browser/runtime-foundation.spec.ts tests/browser/parent-web.spec.ts tests/browser/admin-core.spec.ts --project=chromium --project=mobile-chrome`
   Accessibility only: `npx playwright test --config playwright.config.ts --grep @a11y --project=chromium`

Baseline (Step 2, before any edit): run commands 3, 4 and 6 and record the pass counts in `code-summary.md`.

## Expected coverage

- At least one happy-path test per new component or helper (`BrandMark`, `withSyllableBreaks`, the three changed pages) and one regression per fix: single-button profile card, whole-card task link, clickable admin cards, hyphenated role names.
- The repository-wide floor stays at 80% for lines, branches and functions (checked in Build and Test with `npm run test:coverage`); never lower a threshold to pass.

## Mocking and stubbing

- Page-render tests (`tests/coverage/*.test.tsx`) await the async server component and call `renderToStaticMarkup`; mock `next/headers`, `next/cache` and `next/navigation` the way `tests/coverage/admin-pages.test.tsx` and `parent-pages.test.tsx` already do. Mock `next/image` only if the jsdom render needs a plain `img`.
- Component tests (`tests/integration/*.test.tsx`) use `@testing-library/react` with the existing `tests/setup.ts`.
- Browser tests use the synthetic profiles (`parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local`); to prove the image-failure behaviour, abort requests matching `**/_next/image*` with `page.route`.

## Test data

Synthetic fixtures only (`src/runtime/synthetic/`, fixture version `waldorf-local-v1`). The group admin overview shows 3 open approvals, 3 records and 2 tasks with the default fixture; assert the relation between card and list rather than hard-coding numbers where a fixture could change.

## Quality gates run later (Build and Test)

`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, start smoke, `npm run test:browser`, `npm run test:a11y`.
