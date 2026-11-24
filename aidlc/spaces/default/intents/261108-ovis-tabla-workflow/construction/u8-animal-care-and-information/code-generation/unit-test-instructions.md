# Unit Test Instructions: u8-animal-care-and-information

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/animal-calendar-slots.test.ts tests/database/animal-table-rights.test.ts tests/database/animal-sign-up-give-up.test.ts tests/database/animal-slot-races.test.ts tests/database/animal-fair-share.test.ts tests/database/animal-checks.test.ts tests/database/info-sections.test.ts tests/database/info-links-duty-card.test.ts tests/database/animal-migration.test.ts
```

Changed existing database tests (the catalogue test, and the tests that touch the duty card, the duty origin check, the audit action list or the notice kinds):

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/identity-catalogue.test.ts tests/database/rota-contracts.test.ts tests/database/swaps-propose-answer.test.ts tests/database/swaps-races.test.ts tests/database/rota-checks.test.ts tests/database/data-adapters.test.ts
```

Seed, data adapter and access policy (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/data/notification-use-cases.test.ts src/access/role-policy.test.ts src/access/access-matrix.test.ts scripts/db/seed/data.test.ts scripts/db/seed/commands.test.ts
```

Facade, renderer and screen tests (Vitest, scoped to the changed and new files):

```bash
npx vitest run src/application/contracts.test.ts src/application/facades.test.ts src/application/authorization.test.ts src/application/animal-care-facade.test.ts src/application/information-facade.test.ts src/application/section-text.test.ts
```

Critical browser flow for animal care and the information page (all three browsers):

```bash
npx playwright test tests/browser/animal-care.spec.ts
```

## Coverage Targets

Application code keeps 80% line, branch and function coverage (the existing thresholds; never lowered). The new database rules are covered by the fixed list per rule (allowed, refused, out of reach, outdated screen, repeated click, two people at once); a cell that does not apply says "nem értelmezhető" with its reason, for example two people at once on a read.

## Mocking and Stubbing

Database tests run against the real local stack as real roles and signed-in accounts; nothing is mocked. Facade and screen tests use the existing in-memory ports. Emails go to the local test mailbox. The daily checks are called with a chosen moment, never with the real clock.

## Test Data

Invented families, parents, school years, groups and sections only. Every phone number or email address used in a test is added to `scripts/verification/privacy-allowlist.json`. Timing tests use the `db:seed:large` set of 30 families with a school year of slots (about 60% held) and sections of realistic length, added by this Unit; timings are the median of 5 warm runs after one warm-up run. No real workbook or person is used.
