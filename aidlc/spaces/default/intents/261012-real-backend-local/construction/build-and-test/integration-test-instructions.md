# Integration Test Instructions: Real local backend

Strategy: Comprehensive. Integration here means tests that cross unit boundaries or use the real local stack (database rules, sign-in service, mail catcher) and the browser suite on real sign-in. Nothing mocks Postgres or the sign-in service for these checks.

## Setup

- The stack must be running (`npm run db:start`, started by the owner). Node 24 on the PATH as in `build-instructions.md`.
- Database tests run on worker schemas `worker_1` to `worker_4`; each test file resets its schema first. The browsers use `worker_1` (chromium), `worker_2` (firefox) and `worker_3` (mobile-chrome) in a phase of their own, never at the same time as the database tests.
- Test data is created by the tests or by the seed (`scripts/db/seed/`); passwords in the seed are fictitious and printed nowhere.

## Commands

| Scope | Command | Unit(s) |
|---|---|---|
| Platform: migrations, audit, idempotency, holds, workers | `npm run test:database:stack` | U1 |
| Role migration (needs PostgreSQL 18 tools) | `npm run test:database:roles` | U1 |
| Identity: sign-in, sessions, invitations, grants, hook, operator | `npm run test:database:identity` | U2 |
| Directory and coordination: schema, functions, sign-up and swap kernel, schedule, lifecycle, adapters | `npm run test:database:directory` | U3 |
| Notifications and Excel import | `npm run test:database:notifications-import` | U4 |
| Audit purge, seed, reset, timing | `npm run test:database:seed` | U5 |
| Same files in shuffled order, to prove independence | `npm run test:database:shuffled` | all |
| Client-bundle scan (no seed module, no service-role key in browser output) | `npm run test:bundle` (after `npm run build`) | U2, U5 |
| Browser journeys and accessibility, three browsers | `npm run test:browser` (after `npm run build`) | all |

Cross-unit boundaries these cover: a sign-in session read by directory and notification functions (U2 to U3, U4); audit events written by every unit through the U1 audit function; the 365-day audit purge called by identity housekeeping (U5 to U2); invitations creating family links (U2 to U3); swap and cancellation decisions raising notifications (U3 to U4); the import commit writing directory records (U4 to U3); the seed building accounts through the sign-in service and records through U3 and U4 tables (U5).

## Coverage targets

At least 80% lines, branches and functions across all production source (`npm run test:coverage`, which is the domain and delivery runs together). The browser suite asserts no serious or critical axe violation on the critical flows.

## Test data management

- Fictitious names, example domains (`@example.test`); account addresses `<schema>.<tag>@example.test`; ids derived from schema and key, so seeding twice gives the same result.
- A failed seed or import leaves no partial data (tested by injected failure).
- Never read `source-materials/waldorf-community-app/Ovis tábla v2.xlsx`; workbook tests build their workbooks in the test.

## Known limits

- Hosted-target checks (a real Supabase project, a deployed app) are not exercised here and stay outstanding evidence.
- Tests that need Docker cannot run in an environment without it.
