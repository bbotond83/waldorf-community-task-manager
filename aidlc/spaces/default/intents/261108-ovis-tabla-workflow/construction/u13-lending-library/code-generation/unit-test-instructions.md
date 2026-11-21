# Unit Test Instructions: u13-lending-library

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR1, NFR3 and NFR10, concurrency tests by NFR5, and timing tests by NFR9. Contains no names or contact details.

## Setup

The local stack must be running and migrated, with the local settings loaded (`source .env.database.local`, and `APP_SESSION_SECRET`, `APP_PUBLIC_URL` and `SMTP_FROM` exported for builds). Stop leftover app servers first (`pkill -f next-server`):

```bash
npm run db:start
```

```bash
npm run db:migrate
```

No new test framework or configuration is needed.

## How to Run This Unit's Tests

New database files (each is also listed in its `test:database:*` script and in `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/library-core.test.ts tests/database/library-books.test.ts tests/database/library-loans.test.ts tests/database/library-races.test.ts tests/database/library-for-later-units.test.ts
```

Changed existing database tests (the catalogue test and the timed-run test that sees the new registry row):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/identity-catalogue.test.ts
```

Seed, data adapter, timed run and access policy (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/data/notification-use-cases.test.ts src/access/role-policy.test.ts src/access/access-matrix.test.ts scripts/timed-run.test.ts scripts/db/seed/data.test.ts scripts/db/seed/commands.test.ts
```

Facade and screen tests (Vitest, scoped to the new and changed files):

```bash
npx vitest run src/application/contracts.test.ts src/application/facades.test.ts src/application/authorization.test.ts
```

Critical browser flow for the library (all three browsers):

```bash
npx playwright test tests/browser/library.spec.ts
```

## Coverage Targets

Application code keeps 80% line, branch and function coverage (the existing thresholds; never lowered). The new database rules are covered by the fixed list per rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); a cell that does not apply says "nem értelmezhető" with its reason. Timing targets: list, book page, borrow, return and add under 2 seconds and the daily check under 5 seconds on the large seed, median of 5 runs after one warm-up.

## Mocking and Stubbing

Database tests run against the real local stack as real roles and signed-in accounts; nothing is mocked. The audit rollback test adds a temporary failing trigger inside the test and removes it afterwards. Facade and screen tests use the existing in-memory ports. Emails go to the local test mailbox.

## Test Data

Invented families, parents and books only. Every phone number or email address used in a test is added to `scripts/verification/privacy-allowlist.json`. Timing tests use the `db:seed:large` set of 30 families with 300 books, each with a loan history, some open loans and some watches. The load is tested with an invented workbook's rows only (`tests/fixtures/fictitious/`). No real workbook or person is used.
