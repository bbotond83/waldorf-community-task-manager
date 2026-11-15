# Unit Test Instructions: u5-reminders-and-email

Standard test strategy: five to eight tests per component, with integration tests at the key boundaries. Security tests are required by NFR3 and NFR1, concurrency tests by NFR5. Contains no names or contact details.

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

Database:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/notices-send.test.ts tests/database/notices-delivery.test.ts tests/database/notices-run.test.ts tests/database/notices-failures.test.ts tests/database/notices-migration.test.ts
```

Changed existing notification database tests:

```bash
npm run test:database:notifications
```

Command and mailer (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/identity/mail.test.ts scripts/timed-run.test.ts scripts/db/seed/commands.test.ts
```

Access policy:

```bash
node --experimental-strip-types --test src/access/role-policy.test.ts src/access/access-matrix.test.ts
```

Data adapters and screens:

```bash
node --experimental-strip-types --test src/data/notifications.test.ts
npx vitest run --config vitest.config.ts tests/integration/notifications.test.tsx tests/unit/navigation-access.test.ts
```

Role walk:

```bash
npx playwright test --config playwright.config.ts tests/browser/delivery-problems.spec.ts
```

(The final file names follow the files this Unit changes; if an existing test file already covers an area, the plan step edits it and this list is corrected in the same step.)

## Coverage Targets

At least 80% line, branch and function coverage across application code, unchanged. SQL is covered by the fixed list below.

## The Fixed List for Database Rules

Each command gets: allowed; refused; out of reach; outdated screen; repeated click; two people at once. The service-role claim, sweep and run record "outdated screen" and the run's "repeated click" as not meaningful, with the reason in the test plan; the second run on one day is its repeated-click case (BR52.5). "Outdated screen" is also not meaningful for `notice_send`: it is an internal function with no screen (recorded in the header of `tests/database/notices-send.test.ts`).

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. Application tests use a fake mail transport for sent, unavailable and rejected, and one integration check reads a real message from the local mail catcher. All data is invented: a super admin, a coordinator, a teacher, and parents of at least four families, some without an account. Every test address is in `scripts/verification/privacy-allowlist.json`.

## Security and Performance Tests

- Run, claim, sweep and outcome functions called directly as a parent, teacher, coordinator and super admin are refused; `notice_send`, facts, check and housekeeping functions are not executable by any application role (NFR3.1, NFR3.2, NFR3.9).
- A parent of another community, an archived parent and a parent without an account get no notice and no email; a service-role call takes the community from the parent (NFR3.2).
- A deactivated account with a queued email: the claim cancels it and returns no address (NFR3.5).
- No table holds an address, email text or server reply after a send; a failing mailer whose error holds an address leaves nothing in logs or tables (NFR1.2, NFR1.4, NFR7.11).
- The failure list result holds no address, parent or family name, and the shared leak test passes for every registered target type (NFR1.3, NFR10.4).
- Registry inserts as every application role are refused; a name with a quote is refused by the pattern (NFR3.7).
- Try again: refused when a listed email got a new try (REMINDER_STALE), listed ones restart when a new failure joined, repeated key returns the stored result, two admins at once start one round (NFR5.5, NFR5.6).
- Two delivery passes at once claim different emails; a claimed email left unrecorded is retried after 10 minutes; a recorded outcome twice changes nothing (NFR5.1, NFR5.2, NFR7.3).
- Two overlapping duty-reminder checks and two overlapping runs send each job and notice once (NFR5.3, NFR5.4); checks run by `lock_step` and the race tests repeat with no deadlock (NFR5.7).
- Removal with a claim held: rows gone, late outcome ignored, no second send (NFR1.6).
- Housekeeping prunes by age, and running the daily checks again after pruning creates no new notice (NFR1.5, NFR1.7).
- A migration test applies the migration over a seeded database and compares notice counts, job states and one title per existing kind (NFR7.8, NFR7.9).
- The notice list and "Kézbesítési hibák" in under 2 seconds and the daily run in under 30 seconds on the `db:seed:large` set; each lookup uses its index with sequential scans off on 10,000 rows (NFR9.1, NFR9.4, NFR9.6).
