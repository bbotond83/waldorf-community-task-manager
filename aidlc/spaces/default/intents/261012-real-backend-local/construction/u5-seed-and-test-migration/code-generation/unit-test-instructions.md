# Unit Test Instructions: U5 Seed and test migration

Test strategy: Comprehensive (10 to 15 tests per component) with the 80% line, branch and function floor on all production source. Methodology: test-after (implement a layer, then write and run its tests).

## Framework and Setup

- Unit tests use the Node test runner (`node --experimental-strip-types --test`) for files under `src/`, `scripts/` and `tests/database/`; component and integration tests use the existing Vitest configuration; database-backed tests run against the real local stack; browser tests use the existing Playwright configuration.
- Prerequisites: Docker Desktop running, Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` written before the `&&` chain), and the stack started with `npm run db:start` (it writes the ignored settings files the tests read).
- Unit and component tests need no stack: they use the injected test doubles in `tests/support/`. Only the database tests and the browser specs use the stack; they run in separate phases, never at the same time (the database tests on `worker_1` to `worker_4`, the browsers on `worker_1` to `worker_3`).

## Unit-Scoped Commands

Every command starts from the repository root after the PATH export above. File names are those of the plan steps and are created as each step is built (the first runnable command before any new test is written is the existing runner check in Step 1).

| Scope | Command |
|---|---|
| Runner check before the first new test | `node --experimental-strip-types --test src/runtime/database/config.test.ts` |
| Dependency audit | `npm audit --audit-level=high` |
| Audit purge, append-only, housekeeping, catalogue | `node --experimental-strip-types --test tests/database/audit-purge.test.ts tests/database/audit.test.ts tests/database/identity-housekeeping.test.ts tests/database/identity-catalogue.test.ts` |
| Migration repeatability | `node --experimental-strip-types --test tests/database/migrations.test.ts` |
| Local-only guard | `node --experimental-strip-types --test scripts/db/local-guard.test.ts` |
| Seed data module | `node --experimental-strip-types --test scripts/db/seed/*.test.ts` |
| Seed, reset, output scan | `node --experimental-strip-types --test tests/database/seed.test.ts tests/database/reset.test.ts` |
| Timing tests | `node --experimental-strip-types --test tests/database/seed-timing.test.ts` |
| All real-stack U5 database tests | `npm run test:database:seed` |
| Shuffled order | `npm run test:database:shuffled` |
| Runtime and session (stack-free) | `npx vitest run --config vitest.config.ts tests/integration/runtime-config-cli.test.ts tests/integration/runtime-shell.test.tsx tests/unit/runtime-boundaries.test.ts` |
| Application layer (stack-free) | `node --experimental-strip-types --test src/application/*.test.ts` |
| Pages and actions on test doubles (stack-free) | `npx vitest run --config vitest.config.ts tests/coverage tests/integration` |
| Deletion proofs and verification scripts | `node --experimental-strip-types --test scripts/verification/replaced-modules.test.ts scripts/verification/lint-scope.test.ts scripts/verification/ci-config.test.ts scripts/verification/verification-core.test.ts` |
| Coverage | `npm run test:coverage` |
| Bundle scan | `npm run test:bundle` |
| Browser and accessibility | `npx playwright test --config playwright.config.ts` (after `npm run build`; the harness resets and seeds each browser's schema before every test file) |
| Full local verification | `npm run verify:local` |

The real-stack commands need the stack running (`npm run db:start`).

## Coverage Targets

At least 80% lines, branches and functions for the new production files (the seed, reset and guard scripts) and for all production source overall (`npm run test:coverage`), measured after the synthetic modules are deleted. Thresholds are never lowered.

## Mocking and Stubbing

- The guard, the seed data module and result mapping are unit-tested with a recording fake database client; a fake that throws midway proves the failed seed leaves nothing.
- Everything that depends on Postgres, row-level security, the audit trigger or the sign-in service runs against the real local stack; no test mocks them for those checks.
- Stack-free component and integration tests use the test doubles in `tests/support/` (extended where a rule needs it); no test imports a synthetic module.
- Time-dependent rules (the 365-day purge) use events placed through the owner connection with an explicit `occurred_at`, never real waiting.

## Test Data

- The seed creates the fictitious small set and the 30-family set; ids and account addresses are derived deterministically per schema. Tests that need data call the seed for their worker schema; tests that create their own records keep using the U2 to U4 helpers and the worker prefix.
- Nothing reads `source-materials/`. Fake passwords, tokens and keys are generated in the test or live only in the seed data module; they are never printed.

## Security and Performance Tests

- Security: guard refusals (hosted-looking, non-loopback, missing setting, bad schema), the output scan for passwords, keys and personal values, the production runtime never importing the seed module, the deletion proofs, the audit purge role matrix and append-only tests, the bundle scan for the seed module and the service-role key.
- Reliability: repeatable seed, failed-seed rollback, reset cleanliness per schema with a second schema untouched, migrations repeatable on every schema with the new file.
- Performance (fails above the limit): small seed 60 s, reset 30 s, 30-family seed 120 s, sign-in 5000 ms on seeded data. The full browser suite duration is reported only.
