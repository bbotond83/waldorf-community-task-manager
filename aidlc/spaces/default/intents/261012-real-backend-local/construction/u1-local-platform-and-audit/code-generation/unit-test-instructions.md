# Unit Test Instructions: U1 Local platform and audit

Test strategy: Comprehensive (10 to 15 tests per component) with the 80% line, branch and function floor on all production source. Methodology: test-after (implement a layer, then write and run its tests).

## Framework and Setup

- Unit tests use the existing Node test runner (`node --experimental-strip-types --test`) for files under `src/` and `scripts/`; component tests use the existing Vitest configuration. Database-backed tests live in `tests/database/` and run with the Node test runner against the local stack.
- Prerequisites for database-backed tests: Docker Desktop running, Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`), and the stack started with `npm run db:start`.

## Unit-Scoped Commands

Each command runs only this unit's tests. The first two need no Docker.

| Scope | Command |
|---|---|
| Runtime configuration | `node --experimental-strip-types --test src/runtime/database/config.test.ts` |
| Database client wrapper | `node --experimental-strip-types --test src/runtime/database/client.test.ts` |
| Migration runner (fake database) | `node --experimental-strip-types --test scripts/db/runner.test.ts` |
| Scans | `node --experimental-strip-types --test scripts/verification/scan-artifacts.test.ts` |
| CI configuration | `node --experimental-strip-types --test scripts/verification/ci-config.test.ts` |
| Migrations, audit, idempotency, holds (real stack) | `node --experimental-strip-types --test tests/database/migrations.test.ts tests/database/audit.test.ts tests/database/idempotency.test.ts tests/database/holds.test.ts` |
| Worker schemas (real stack) | `node --experimental-strip-types --test tests/database/worker.test.ts` |

The first runnable command before any test is written is the configuration test command above (the runner already exists).

## Coverage Targets

At least 80% lines, branches and functions for the new production files, and for all production source overall (existing `npm run test:coverage`).

## Mocking and Stubbing

- The migration runner's ordering and failure behaviour is unit-tested with a fake database connection.
- Everything that depends on Postgres, the data API or row access rules runs against the real local stack; no test mocks the database for these.
- Scans are tested against temporary directories with planted files, never against real personal data. Fake secrets are generated in the test.

## Test Data

- Tests create the audit, idempotency and hold data they need and do not rely on the seed (U5).
- Worker schemas `worker_1` to `worker_4` isolate parallel runs; each test file resets its schema first. Fictitious fixtures live only in `tests/fixtures/fictitious/`.

## Security and Performance Tests

- Security: wrong-role refusal on the audit function and table, no update or delete of events, the service-role key never in app code or client output, output tests with fake secrets.
- Performance (reported): stack start, migrations, worker setup and scans against the NFR4 targets; audit overhead under 50 ms per operation.
