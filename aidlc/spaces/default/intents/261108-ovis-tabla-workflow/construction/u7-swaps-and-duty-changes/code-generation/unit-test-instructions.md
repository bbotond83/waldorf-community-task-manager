# Unit Test Instructions: u7-swaps-and-duty-changes

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR1, NFR3 and NFR4, concurrency tests by NFR5, and timing tests by NFR9. Contains no names or contact details.

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/swaps-schema.test.ts tests/database/swaps-propose-answer.test.ts tests/database/swaps-admin.test.ts tests/database/swaps-races.test.ts tests/database/swaps-for-later-units.test.ts tests/database/swaps-timing.test.ts
```

Changed existing database tests (the earlier swap, coordination and role tests, and the catalogue test):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/kernel-swaps.test.ts tests/database/coordination-functions.test.ts tests/database/community-duties.test.ts tests/database/community-roles.test.ts tests/database/identity-catalogue.test.ts
```

Data port, notification use cases and access policy (Node test files under `src/`):

```bash
node --experimental-strip-types --test src/data/notification-use-cases.test.ts src/data/parent-port.test.ts src/data/admin-port.test.ts src/access/request-actions.test.ts
```

Facade, mapping and screen tests (Vitest, scoped to the new and changed files):

```bash
npx vitest run tests/unit/navigation-access.test.ts
```

Critical browser flow for swaps (all three browsers):

```bash
npx playwright test tests/browser/swaps.spec.ts
```

## Coverage Targets

Application code keeps 80% line, branch and function coverage (the existing thresholds; never lowered). The new database rules are covered by the fixed list per rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); a cell that does not apply says "nem értelmezhető" with its reason. Timing targets are those of `nfr-design/performance-design.md` (NFR9.1 to NFR9.3) on the large seed, median of 5 runs after one warm-up.

## Mocking and Stubbing

Database tests run against the real local stack as real roles and signed-in accounts; nothing is mocked. The audit rollback tests add a temporary failing trigger inside the test and remove it afterwards. Facade and screen tests use the existing in-memory ports. Emails go to the local test mailbox. Race tests repeat each two-at-once case 20 times inside the file.

## Test Data

Invented families, parents and duties only. Every phone number or email address used in a test is added to `scripts/verification/privacy-allowlist.json`. Timing tests use the `db:seed:large` set with a published year of rotas, invented event and manual duties and 200 change requests in every status. No real workbook or person is used.
