# Unit Test Instructions: u12-todo-and-my-tasks

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR3, NFR1 and NFR10, concurrency tests by NFR5, and timing tests by NFR9. Contains no names or contact details.

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

New database files:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/todo-tasks.test.ts tests/database/todo-claims.test.ts tests/database/todo-races.test.ts tests/database/todo-pull.test.ts tests/database/todo-reads.test.ts tests/database/todo-checks.test.ts tests/database/todo-for-later-units.test.ts tests/database/todo-removal.test.ts tests/database/todo-migration.test.ts
```

Changed existing database tests (the catalogue test and the tests that touch the group page links or the checklist reads):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/identity-catalogue.test.ts tests/database/checklist-claims.test.ts tests/database/checklist-checks.test.ts tests/database/data-adapters.test.ts
```

Seed, data adapter and access policy (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/data/notification-use-cases.test.ts src/access/role-policy.test.ts src/access/access-matrix.test.ts scripts/db/seed/data.test.ts scripts/db/seed/commands.test.ts
```

Facade and screen tests (Vitest, scoped to the changed files):

```bash
npx vitest run src/application/contracts.test.ts src/application/facades.test.ts src/application/authorization.test.ts
```

Critical browser flow for to-do tasks (all three browsers):

```bash
npx playwright test tests/browser/todo.spec.ts
```

## Coverage Targets

Application code keeps 80% line, branch and function coverage (the existing thresholds; never lowered). The new database rules are covered by the fixed list per rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); a cell that does not apply says "nem értelmezhető" with its reason, for example two people at once on a read.

## Mocking and Stubbing

Database tests run against the real local stack as real roles and signed-in accounts; nothing is mocked. Facade and screen tests use the existing in-memory ports. Emails go to the local test mailbox.

## Test Data

Invented families, parents, groups, tasks and events only. Every phone number or email address used in a test is added to `scripts/verification/privacy-allowlist.json`. Timing tests use the `db:seed:large` set of 30 families plus a few hundred invented tasks added by this Unit. The migration load uses only the invented workbook in `tests/fixtures/fictitious/`. No real workbook or person is used.
