# Unit Test Instructions: U3 Directory, settings and coordination

Test strategy: Comprehensive (10 to 15 tests per component) with the 80% line, branch and function floor on all production source. Methodology: test-after (implement a layer, then write and run its tests).

## Framework and Setup

- Unit tests use the Node test runner (`node --experimental-strip-types --test`) for files under `src/` and `scripts/`; component and integration tests use the existing Vitest configuration; database-backed tests live in `tests/database/` and run against the real local stack with the Node test runner; browser tests use the existing Playwright configuration.
- Prerequisites: Docker Desktop running (the CLI lives at `/Applications/Docker.app/Contents/Resources/bin`), Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` written before the `&&` chain), and the stack started with `npm run db:start` (it writes the ignored settings files the tests read).

## Unit-Scoped Commands

Every command starts from the repository root after the PATH export above. The commands name exact files; file names are those of the plan steps and are created as each step is built (the first runnable command before any new test is written is the existing runner check in Step 2).

| Scope | Command |
|---|---|
| Runner check before the first new test (existing identity configuration test) | `node --experimental-strip-types --test src/runtime/database/config.test.ts` |
| Directory and Settings schema | `node --experimental-strip-types --test tests/database/directory-schema.test.ts` |
| Directory and Settings functions | `node --experimental-strip-types --test tests/database/directory-functions.test.ts` |
| Coordination schema, event, task and note functions | `node --experimental-strip-types --test tests/database/coordination-schema.test.ts tests/database/coordination-functions.test.ts` |
| Sign-up, listing, admin assignment and the race | `node --experimental-strip-types --test tests/database/kernel-signup.test.ts tests/database/kernel-race.test.ts` |
| Swaps and cancellations | `node --experimental-strip-types --test tests/database/kernel-swaps.test.ts` |
| Family archive and restore, invitation link, dashboard, governance | `node --experimental-strip-types --test tests/database/kernel-family.test.ts tests/database/directory-link.test.ts` |
| Teacher schedule | `node --experimental-strip-types --test tests/database/schedule.test.ts` |
| Lifecycle | `node --experimental-strip-types --test tests/database/lifecycle.test.ts` |
| U2 rewrite and placeholder tables | `node --experimental-strip-types --test tests/database/placeholder-drop.test.ts` and `npm run test:database:identity` (the whole U2 identity suite, re-run on the rewritten functions) |
| Migration repeatability and timings | `node --experimental-strip-types --test tests/database/migrations.test.ts tests/database/directory-timing.test.ts` |
| All real-stack U3 tests | `npm run test:database:directory` |
| Shuffled order | `npm run test:database:shuffled` |
| Adapters (fakes) | `node --experimental-strip-types --test src/data/*.test.ts` |
| Adapters on the real stack (code-by-code contract test) | `node --experimental-strip-types --test tests/database/data-adapters.test.ts` |
| Composition, wiring and access policy | `npx vitest run --config vitest.config.ts tests/integration/production-wiring.test.ts` and `node --experimental-strip-types --test src/access/*.test.ts` |
| Screens and copy | `npx vitest run --config vitest.config.ts tests/integration/swap-screens.test.tsx tests/integration/admin-forms.test.tsx tests/integration/copy.test.ts` |
| Lint and format scope guard | `node --experimental-strip-types --test scripts/verification/lint-scope.test.ts` |
| Browser and accessibility | `npx playwright test --config playwright.config.ts tests/browser/directory-coordination.spec.ts` |

The real-stack commands need the stack running (`npm run db:start`).

## Coverage Targets

At least 80% lines, branches and functions for the new production files and for all production source overall (existing `npm run test:coverage`), measured after the replaced modules are deleted. The old modules' proofs are rewritten against the database before deletion (BR34.1).

## Mocking and Stubbing

- Result mapping, error mapping and the family lookup in `src/data/` are unit-tested with a fake database client.
- Everything that depends on Postgres, row-level security or the sign-in service runs against the real local stack; no test mocks them for those checks.
- Time-dependent rules (task start, grace period, invitation expiry) use a controllable database clock or injected time, never real waiting.

## Test Data

- Tests create the organizations, groups, families, parents, tasks and accounts they need (U2's `identity-support.ts` helpers and the worker account prefix isolate parallel runs); they do not rely on the seed (U5).
- `tests/database/dataset.ts` generates the 150-family, 10-group, 300-task, 1500-assignment set inside a worker schema for the timing and race tests.
- Fake passwords, tokens and keys are generated in the test and never written to tracked files; fake personal data is used in the output scans.

## Security and Performance Tests

- Security: the role matrix for every table and function (parent, co-parent, parent of another family, teacher of the group and of another group, group admin of the group and of another group, super admin, signed-out, deactivated), contact and note visibility on every read path, cross-organization isolation, the elevated-function catalogue and service-role privilege list for every U3 object, forged swap and decision attempts, validation and markup-injection tests, output scans for personal data, lifecycle completeness.
- Concurrency: 20 parallel sign-ups for 5 places, crossing swaps, archive versus swap, the parent-link race.
- Performance (reported): list, detail, schedule, action and dashboard timings on the 150-family set (fail above 1500 ms), U2's access-check overhead re-run (fails above 200 ms), one browser timing of the parent task list page.
