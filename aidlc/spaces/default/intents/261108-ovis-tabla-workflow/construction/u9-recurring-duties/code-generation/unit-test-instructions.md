# Unit Test Instructions: u9-recurring-duties

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/recurring-core.test.ts tests/database/recurring-commands.test.ts tests/database/recurring-occurrences.test.ts tests/database/recurring-timing.test.ts tests/database/recurring-check.test.ts tests/database/recurring-for-later-units.test.ts
```

Changed existing database test (the catalogue test sees the new functions, tables and registry row):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/identity-catalogue.test.ts
```

Seed, data adapter, notice registry, access policy, and the contracts, facades, authorization and format helpers (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/data/notification-use-cases.test.ts src/data/recurring.test.ts src/access/role-policy.test.ts src/access/access-matrix.test.ts src/application/contracts.test.ts src/application/facades.test.ts src/application/authorization.test.ts src/application/recurring-format.test.ts scripts/timed-run.test.ts scripts/db/seed/data.test.ts scripts/db/seed/commands.test.ts
```

Screen, action, access and page tests (Vitest, scoped to the new and changed files):

```bash
npx vitest run tests/integration/recurring-screens.test.tsx tests/integration/recurring-actions.test.ts tests/integration/recurring-actor.test.ts tests/integration/recurring-pages.test.tsx
```

Critical browser flow for recurring duties (all three browsers):

```bash
npx playwright test tests/browser/recurring.spec.ts
```

## Coverage Targets

Application code keeps 80% line, branch and function coverage (the existing thresholds; never lowered). The new database rules are covered by the fixed list per rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); a cell that does not apply says "nem értelmezhető" with its reason. Timing targets: group page, family page, duty card, save and mark done under 2 seconds; the daily check under 5 seconds with every schedule due, notices created and email mocked, and a second run the same day under 2 seconds; all on the large seed, median of 5 runs after one warm-up.

## Mocking and Stubbing

Database tests run against the real local stack as real roles and signed-in accounts; nothing is mocked. The audit rollback test adds a temporary failing trigger inside the test and removes it afterwards. The daily check takes its moment as an argument, so clock-change weeks and notice-window days are tested by setting the moment, not by waiting. Facade and screen tests use the existing in-memory ports. Emails go to the local test mailbox.

## Test Data

All data is invented: fictitious families, people and Hungarian duty titles from the seed. Any address or phone number in a test is added to `scripts/verification/privacy-allowlist.json`. The race cases repeat 20 times inside their test file.

## Fixed List per Rule

The six cases (allowed, refused, out of reach, outdated screen, repeated click, two people at once) are planned per rule in the test files named in the plan. The notice-window table of `reliability-design.md` (D-REL-1) is asserted case by case in `tests/database/recurring-check.test.ts`.
