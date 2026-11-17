# Unit Test Instructions: u6-full-rotas-and-weekend-picks

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
node --experimental-strip-types --test --test-concurrency=1 tests/database/rota-standing.test.ts tests/database/rota-draft-grid.test.ts tests/database/rota-four-plan.test.ts tests/database/rota-full-migration.test.ts tests/database/weekend-picks.test.ts tests/database/weekend-picks-races.test.ts tests/database/rota-checks.test.ts tests/database/rota-contracts.test.ts
```

Changed existing rota and sign-up database tests:

```bash
node --experimental-strip-types --test --test-concurrency=1 tests/database/rota-plan.test.ts tests/database/rota-calendar.test.ts tests/database/rota-migration.test.ts tests/database/kernel-signup.test.ts tests/database/kernel-swaps.test.ts tests/database/data-adapters.test.ts
```

Seed, data adapter and access policy (Node test files under `src/` and `scripts/`):

```bash
node --experimental-strip-types --test src/data/rota.test.ts src/access/role-policy.test.ts src/access/access-matrix.test.ts scripts/db/seed/data.test.ts scripts/db/seed/commands.test.ts
```

Screens and messages:

```bash
npx vitest run --config vitest.config.ts tests/integration/rota.test.tsx tests/integration/copy.test.ts tests/unit/navigation-access.test.ts
```

Role walk and timing:

```bash
npx playwright test --config playwright.config.ts tests/browser/rota.spec.ts tests/browser/rota-timing.spec.ts
```

(The final file names follow the files this Unit changes; if an existing test file already covers an area, the plan step edits it and this list is corrected in the same step.)

## Coverage Targets

At least 80% line, branch and function coverage across application code, unchanged. SQL is covered by the fixed list below.

## The Fixed List for Database Rules

Each command (`family_standing_set`, `weekend_pick_set`, `weekend_pick_assign`, and the changed draft, set-week and publish commands) gets: allowed; refused; out of reach; outdated screen; repeated click; two people at once. The plan table has one row per rule of `rules.md` with a named test in every cell, or "nem értelmezhető" with the reason. Known cases with no meaning: "outdated screen" and "two people at once" for the read-only functions (`family_may_hold_duty`, `family_standing`, `rota_family_for`, `rota_check_change`, the overview and the card); "outdated screen" for the three checks, whose "repeated click" case is a second run and whose "two people at once" case is two overlapping runs.

## Mocking and Test Data

Database tests act as real database roles and signed-in accounts on the local stack, with no mocks. The moment of a run or a command is set by the test where a time rule is checked: the checks take a moment from the service-role run; the boundary helper is tested directly with a week's Monday and a chosen moment; and the pick commands, which use the database clock, are tested on a plan whose weeks are placed around the current date (a week before Friday noon, one after it, one already past). All data is invented: a super admin, a working-group administrator, a teacher, and parents of at least four families (an indoor-cleaning, a front-garden and a weekend family for one week, and one unrelated family), one family marked leaving and one new. Every test address is in `scripts/verification/privacy-allowlist.json`. Application tests use the existing in-memory ports.

## Security and Performance Tests

- Setting a standing, assigning a pick, and reading standings, flagged duties and the unpicked list as a parent, teacher and working-group administrator are refused, with a denied refusal and never an empty list (NFR3.2).
- A parent picking for another family's week gets the same refusal as for a made-up week; the shelter cleaning and another weekend's slot are refused (NFR3.3).
- The weekend state is returned to the week's three families and super admins only; the duty card is refused for an unrelated parent, a teacher and a working-group administrator (NFR3.4).
- `family_may_hold_duty`, `family_standing`, `families_with_standing`, `rota_check_change`, `rota_adjust_picks_after_change`, `rota_family_for`, `rota_planning_removal_preview`, `rota_planning_removal_apply`, `weekend_picks_due_check`, `weekend_picks_alert_check` and `rota_week_reminder_check` are not executable by any application role (NFR3.5).
- Each of today's change functions refuses a weekend duty with DUTY_ROTA_MANAGED (NFR3.6).
- A parent removed from the family, and a super admin whose role is revoked, are refused on the next request (NFR3.8).
- The overview, card, weekend state and unpicked list return family display names only; standings are never returned to a parent, and the DUTY_INELIGIBLE reason goes only to a super admin or the family's own parent (NFR1.2, NFR1.3).
- Each notice kind's text and email hold the job, week and slot and no contact detail; the publishing notice lists only the receiver's own weeks (NFR10.1, NFR10.2).
- Two families on one slot, a pick against an assignment, and two administrators on one standing each leave one consistent result; the invariant query finds no pick without its place (NFR5.2 to NFR5.4, NFR7.2).
- Each check run twice and in parallel sends each notice once; a run one day late still sends what is due (NFR5.5, NFR7.6).
- Boundaries at Wednesday 00:00, Friday 12:00 and Saturday 00:00 hold in a normal week and in both clock-change weeks (NFR7.5).
- The migration applied over a seeded database with a draft and a published plan keeps every row and adds the `not_drafted` rows (NFR7.4).
- On the `db:seed:large` set: each page under 2 seconds, draft and publish under 5 seconds each, each check under 2 seconds, and today's task lists no slower than before (NFR9.1 to NFR9.5).
