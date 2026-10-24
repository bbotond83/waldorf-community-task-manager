# Unit Test Instructions: U4 Notifications and Excel import

Test strategy: Comprehensive (10 to 15 tests per component) with the 80% line, branch and function floor on all production source. Methodology: test-after (implement a layer, then write and run its tests).

## Framework and Setup

- Unit tests use the Node test runner (`node --experimental-strip-types --test`) for files under `src/` and `scripts/`; component and integration tests use the existing Vitest configuration; database-backed tests live in `tests/database/` and run against the real local stack with the Node test runner; browser tests use the existing Playwright configuration.
- Prerequisites: Docker Desktop running, Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` written before the `&&` chain), and the stack started with `npm run db:start` (it writes the ignored settings files the tests read).

## Unit-Scoped Commands

Every command starts from the repository root after the PATH export above. File names are those of the plan steps and are created as each step is built (the first runnable command before any new test is written is the existing runner check in Step 2).

| Scope | Command |
|---|---|
| Runner check before the first new test | `node --experimental-strip-types --test src/runtime/database/config.test.ts` |
| Notifications schema | `node --experimental-strip-types --test tests/database/notifications-schema.test.ts` |
| Notification and reminder functions | `node --experimental-strip-types --test tests/database/notifications-functions.test.ts` |
| Hand-off, failure injection and races | `node --experimental-strip-types --test tests/database/notifications-handoff.test.ts` |
| Import schema | `node --experimental-strip-types --test tests/database/import-schema.test.ts` |
| Import preview, resolve, status, recovery | `node --experimental-strip-types --test tests/database/import-functions.test.ts` |
| Import commit | `node --experimental-strip-types --test tests/database/import-commit.test.ts` |
| Catalogue, history leak, timings | `node --experimental-strip-types --test tests/database/import-catalogue.test.ts tests/database/import-privacy.test.ts tests/database/notifications-timing.test.ts` |
| All real-stack U4 tests | `npm run test:database:notifications-import` |
| Shuffled order | `npm run test:database:shuffled` |
| Parser and generator | `node --experimental-strip-types --test src/import-parser/*.test.ts` |
| Adapters (fakes) | `node --experimental-strip-types --test src/data/*.test.ts` |
| Adapters on the real stack | `node --experimental-strip-types --test tests/database/notifications-adapters.test.ts` |
| Wiring and screens | `npx vitest run --config vitest.config.ts tests/integration/notifications-wiring.test.ts tests/integration/import-screens.test.tsx tests/integration/import-actions.test.ts tests/integration/copy.test.ts` |
| Lint scope guard and replaced modules | `node --experimental-strip-types --test scripts/verification/lint-scope.test.ts scripts/verification/replaced-modules.test.ts` |
| U2 and U3 suites (re-run on the changed U3 functions) | `npm run test:database:identity` and `npm run test:database:directory` |
| Browser and accessibility | `npx playwright test --config playwright.config.ts tests/browser/notifications-import.spec.ts` (against a production build on its own port, as in U3) |

The real-stack commands need the stack running (`npm run db:start`).

## Coverage Targets

At least 80% lines, branches and functions for the new production files and for all production source overall (`npm run test:coverage`), measured after `src/notifications` and `src/import-migration` are deleted; their proofs are rewritten against the database before deletion (BR43.1).

## Mocking and Stubbing

- Result and error mapping, key freshness, the version sequence and the lazy tick in `src/data/` are unit-tested with a fake database client; a client that throws a retryable error after the call proves the interrupted-marking path.
- Everything that depends on Postgres, row-level security or the sign-in service runs against the real local stack; no test mocks them for those checks.
- Time-dependent rules (reminder thresholds, expiry, task start) use a controllable database clock or injected time, never real waiting.

## Test Data

- Tests create the organizations, groups, families, parents, tasks, accounts and workbooks they need (U2 and U3 helpers and the worker prefix isolate parallel runs); they do not rely on the seed (U5).
- `tests/support/workbook.ts` generates the fictitious 17-sheet workbook from the template of the design; the data-set generator extends U3's with 3000 notifications and 600 reminder jobs. Nothing reads `source-materials/`.
- Fake passwords, tokens and keys are generated in the test and never written to tracked files; fake personal data is used in the output scans.

## Security and Performance Tests

- Security: the role matrix for every table and function (parent whose notice it is, another parent, teacher, group admin, the super admin who started the run, another super admin, member of another organization, system caller, signed-out, deactivated), staged-row privacy, history-leak search, hostile workbook cases, the bundle scan after the build, the output scan with fake personal data, markup injection in lists, commit re-match drift tests.
- Concurrency: double preview by one admin, two admins, double commit, commit against crossing swap and archive, concurrent ticks.
- Performance (reported): preview and commit of a 2000-row workbook (fail above 60 s), maximum workbook and zip-bomb (fail above 60 s), lists on the 3000-notification set (fail above 1500 ms), the tick on 600 jobs (fail above 10 s), U3 and U2 timing re-runs.
