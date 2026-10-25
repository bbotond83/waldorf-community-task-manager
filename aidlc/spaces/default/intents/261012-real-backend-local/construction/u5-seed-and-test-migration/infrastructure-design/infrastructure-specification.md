# Infrastructure Specification: U5 Seed and test migration

No hosted infrastructure is created or changed and no deployment workflow is added. U5 reuses the local stack of U1 to U4 and adds three developer commands, one tracked seed-data module, one database function and test configuration. Source: `infrastructure-design-questions.md` (assumptions confirmed), the requirements of this unit, and U1 to U4's specifications.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: containers on Docker Desktop started by the pinned Supabase CLI; the web app runs as before. The seed, reset and timing commands are Node scripts run by the developer or by CI | Nothing new to deploy |
| Networking | Unchanged: published ports checked by `db:start` for non-loopback exposure (U1). Seed and reset connect only to the loopback address and refuse anything else (NFR1.63) | U1 decisions stand |
| Environments | Local development and CI only | No deployment workflow before a deployable application and a linked target exist (team rule) |
| Infrastructure as code | One new SQL migration (the audit purge), new scripts in `scripts/db/`, the seed module `scripts/db/seed/`, changes to `package.json`, `playwright.config.ts` and `.github/workflows/ci.yml`; `supabase/config.toml` is unchanged (it already serves `worker_1` to `worker_4`) | One mechanism, as U1 to U4 |
| Test schemas | `worker_1` to `worker_4` stay the only test schemas. Database tests use `worker_1` to `worker_4` in their phase; the three browsers use `worker_1` to `worker_3` in the browser phase, one browser per schema with its own server and port; the phases run one after the other and each resets the schemas it uses, so no two runs share a schema at the same time (answer to Q1; NFR3.20 is read as "never at the same time") | Nothing new to build; no extra migrations applied |
| Mail | Unchanged: the local mail catcher; the seed sends no mail | FR8.1 |
| Scheduler | None. Housekeeping calls the audit purge together with the other housekeeping functions; `db:reset` calls the expiry and reminder-tick system functions (NFR6.28) | Local environment |

## Commands and database changes

| Item | Change | Rule |
|---|---|---|
| Schema selector | All three commands take `--schema <name>` (`public` by default, or `worker_1` to `worker_4`); any other name is refused. The browser setup and the timing tests pass it | NFR3.20, NFR4.17 |
| Seed accounts per schema | The sign-in service is shared by every schema, so seeded accounts are scoped by schema: the address is `<schema>.<tag>@example.test` (the prefix `db:worker` already uses, so `public.` for the default schema) and the account id is derived deterministically from the schema name and the account's key (a fixed namespace, exported by the seed module and used by tests). Ids are stable per schema, never equal across schemas | FR3.2, NFR3.18 |
| `npm run db:seed` | Small set: 2 groups, about 6 families with parents and children, a group admin, a super admin, a teacher, a few events and tasks; accounts created directly with the tracked fictitious passwords; one transaction per schema; refuses a non-local database | NFR1.63, NFR1.64, NFR3.18, NFR3.19 |
| `npm run db:seed:large` | The 30-family set from the same data module (a deterministic generator over the small set's rules) | NFR4.18 |
| `npm run db:reset` | For the chosen schema only: truncates every table of the schema except reference data, including `audit_events` (a truncate by the owner connection does not fire the row trigger; the append-only tests keep proving that updates and deletes are refused), removes only the accounts whose address starts with that schema's prefix (never another schema's, and never accounts of `db:worker`'s other prefixes), runs the expiry and reminder-tick system functions; leaves the stack running | NFR6.28, NFR4.17 |
| `db:worker -- <name> --reset` | Unchanged; the test suites call the same setup and then the seed for the small set where a test needs data | NFR3.20, NFR3.21 |
| Shared guard | One function (`scripts/db/local-guard.ts`) used by seed and reset: loopback address, and the database identifies itself as the local stack; plain refusal otherwise | NFR2.32 |
| Seed data module | `scripts/db/seed/` holds the data, the fixed uuids and the fictitious test passwords; nothing else holds a password | NFR2.31, NFR1.64 |
| Audit purge migration | `20261044_audit_purge.sql`, the next number after U4's last (`20261043_u4_repairs.sql`), forward-only. Three parts. (1) The append-only trigger of `20261012_platform_audit.sql` refuses every delete today, so the migration replaces its function `audit_events_refuse_change()`: an update is always refused; a delete is allowed only while the transaction-local setting `app.audit_purge` is `on` and only for a row whose `occurred_at` is older than 365 days; every other delete is still refused with the same error. (2) A new security-definer function `audit_purge()` with `SET search_path FROM CURRENT`, execute only for the system caller (`service_role`), sets that setting for its own transaction with `set_config(..., true)`, deletes the aged rows and returns the count; it writes no audit event and no personal data; it has an entry in the elevated-function catalogue. (3) `identity_housekeeping()` (last defined in `20261043_u4_repairs.sql`) is re-created from its `20261043` body with one added call to `audit_purge()` and the count added to its result, with its revoke and grant lines restated unchanged. The seed and reset never call the purge (the requirement's mention of them is narrowed: housekeeping only). | NFR1.68, NFR2.35 |
| Audit tests that change | `tests/database/audit.test.ts` (append-only still holds: an update, a delete of a recent row and a delete outside the purge are refused), `tests/database/identity-housekeeping.test.ts` (the result carries the purge count) and `tests/database/identity-catalogue.test.ts` (the new entry); aged events are placed by the test through the owner connection with an explicit `occurred_at` (the owner connection bypasses the table's revokes), one just under and one just over 365 days | NFR1.68 |
| Removed from the application | The synthetic composition, fixtures, reset endpoint, per-browser copies, profile picker, `scenario` hooks, the four synthetic adapters and `src/teacher-tracking`; `APP_RUNTIME_MODE` loses its synthetic value | NFR1.67, NFR2.34 |

All migration files are forward-only; merged files are never edited (a correction note goes in the code summary).

## Application and tool configuration

| Item | Change | Rule |
|---|---|---|
| `package.json` | Scripts `db:seed`, `db:seed:large`, `db:reset`; `lint`, `format` and `format:check` lists cover `scripts/db/seed/` (already inside `scripts`) and drop deleted folders; `zod` and the packages behind `undici` updated as the first task; no new dependency | NFR2.36, NFR2.37 |
| `playwright.config.ts` | Three browser projects with an explicit map: `chromium` uses `worker_1` and the first port, `firefox` uses `worker_2` and the second, `mobile-chrome` uses `worker_3` and the third; each server gets its schema in `DATABASE_SCHEMA`; `workers: 1`; synthetic settings removed | NFR3.20, NFR2.33 |
| Reset before each test file | A shared helper in `tests/browser/support/` registers a `test.beforeAll` that runs reset and then the small seed for the project's schema; every spec calls it (a guard test fails when a spec does not). Playwright re-runs `beforeAll` in the new worker when a failed test is retried, so a retry never sees the data a failed attempt left | NFR3.20 |
| Tests that need the database | Only the database tests (`tests/database/`) and the browser specs use the stack. Unit and component tests stay stack-free: they use the injected test doubles (`tests/support/data-fakes.ts`) as U3 and U4 do, with no synthetic code; NFR3.21 is read this way, which also keeps `npm test` and coverage independent of the stack | NFR3.21 |
| Test specs | Data-exercising browser specs sign in through the real sign-in with seeded accounts; the profile-picker timing specs and their config are deleted; a new sign-in timing test (5000 ms) runs on seeded data | NFR4.19, NFR7.5 |
| Environment variables | `APP_RUNTIME_MODE` is removed entirely (there is one runtime, FR1.3), with `APP_SYNTHETIC_FIXTURE_VERSION` and `SYNTHETIC_TEST_COPIES`: `src/runtime/config.ts` and the composition lose the synthetic branch, `scripts/validate-runtime-config.ts` and its tests follow; no new variable | FR1.3 |
| Documents | `README.md`, `HASZNALATI_UTMUTATO_HU.md`, and a report on the real workbook in git history and the known limits | NFR2.38 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | database | One new function (audit purge); seed and reset run against it by the service-role connection of the local stack | Same schemas as U1 to U4 |
| Sign-in service (Auth) | identity provider | The seed creates accounts through its admin interface; the reset removes them | Local only |
| Mail server (Inbucket) | receives mail | Unchanged | Not used by seed or reset |
| Disabled services | Studio, storage, realtime, edge functions, analytics, pooler | Unchanged | U1 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Worker schemas `worker_1` to `worker_4` | U1 | U2 to U5 | One phase at a time (database, then browser); each phase resets what it uses; accounts are scoped by the schema prefix in the shared sign-in service |
| Sign-in service accounts (shared by all schemas) | U2 | U3 to U5 | Seed and reset touch only the accounts with their schema's address prefix |
| Elevated function list | U2 | U3, U4, U5 (appends the audit purge) | The catalogue test fails when an entry is missing |
| Seed data module | U5 | Database and browser tests | Tests only; never imported by the production runtime (NFR1.64) |
