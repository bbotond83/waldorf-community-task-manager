# Test Results

Run date: 2026-11-04, on the final working tree (nothing committed), Node 24.x, local Supabase stack running, production build.

## Build

- `npm run build`: success (Next.js 16.4.2, Turbopack; all 33 routes built).
- `npm run smoke:start`: `SMOKE_START_OK: waldorf-local-ready`.

## Static checks

- `npm run lint`: pass (0 warnings).
- `npm run lint:css`: pass (Stylelint, 0 warnings).
- `npm run format:check`: pass.
- `npm run typecheck`: pass.

## Unit and coverage tests

- `npm run test:coverage`: domain tests 511 of 511 (node test runner); delivery tests 130 files and 1660 tests passed, 0 failed.
- Coverage across all production source: statements 96.95% (5245 of 5410), branches 91.09% (4050 of 4446), functions 95.66% (1214 of 1269), lines 97.92% (4671 of 4770). Thresholds 80/80/80 are unchanged.

## Browser tests (integration, against the real local database)

- `npx playwright test --config playwright.config.ts` in all three configured projects (chromium, firefox, mobile-chrome): 645 tests, 606 passed, 39 skipped, 0 failed, in 15.3 minutes. The project defines no WebKit project.
- The skips are explicit `test.skip` cases (single-browser production-server specs such as `directory-coordination` and `notifications-import` outside Chromium, a mobile-only case, one identity case); the same kinds of skip were explained in the U3 to U5 reviews (18, 36 and 9 skips in the unit batches). The 39 skips of this run were not listed one by one; the new restyle specs report no skip of their own except the Chromium-only font-report check.
- The accessibility scans (`@a11y`) ran inside this run in every project and found no serious or critical violation.

## Security and dependency scans

- `npm run verify:security`: exit 0. `PRIVACY_SCAN_PASS files=1206`, `SECRETS_SCAN_PASS files=2066`, `SAST_SCAN_PASS files=429`, `NO-DEPLOY_SCAN_PASS files=429`, and `npm audit --audit-level=high` passed: no high or critical advisory.
- `npm audit` reports 16 moderate advisories, all in development tooling (the ESLint plugin family via `minimatch`). They do not block (the rule blocks high and critical) and are listed here, not hidden.
- A first privacy-scan attempt failed because it ran while the browser run was still writing trace files with test e-mail addresses into `test-results/`; the rerun after the browser run finished passed. Run the scan only when no browser run is in progress.

## Failures

None. No loop-back was needed (`## Loop-Back Log`: no entries).

## Not run

- `npm run test:database:*` suites: this work does not touch the database layer; they remain for the project's regular run.
- CI: the plan runs no CI Pipeline stage, and nothing is committed or pushed yet.
- The owner's visual comparison with the Stitch screens is manual by team rule; it was done per unit (U1 to U5 approvals).
