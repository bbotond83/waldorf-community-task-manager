# Infrastructure Specification: U4 Notifications and Excel import

No hosted infrastructure is created or changed and no deployment workflow is added. U4 reuses the local stack of U1 to U3 and adds database objects, a server-only parser module with one library, one application setting and tests. Source: `infrastructure-design-questions.md` (assumptions confirmed), the functional design, the NFR requirements, and U1 to U3's infrastructure specifications.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: containers on Docker Desktop started by the pinned Supabase CLI; the web app runs as before | Nothing new to deploy |
| Networking | Unchanged: published ports checked by `db:start` for non-loopback exposure (U1) | U1 decisions stand |
| Environments | Local development and CI only | No deployment workflow before a deployable application and a linked target exist (team rule) |
| Infrastructure as code | New SQL migration files; `next.config.ts` (upload limit); `package.json` (library); `supabase/config.toml`, `.env.example` and the workflow's environment values unchanged | One mechanism, as U1 to U3 |
| Mail | Unchanged; delivery of reminders is simulated, nothing is sent | FR8.1 |
| Scheduler | None: the reminder tick is a database function called lazily by the server, the seed and housekeeping (NFR2.22) | Local environment, simulated delivery |

## Database Changes (new migration files, applied by U1's runner in the default and the four worker schemas, numbered from `20261036` on, after U3's four `20261035_*` files; the file that creates or replaces U3's functions sorts after them)

| Change | Rule |
|---|---|
| Notifications: tables `notifications`, `reminder_jobs`, `reminder_recipients`, `reminder_attempts` with the columns, constraints (unique live job per task and threshold, unique dedupe key, at most 3 attempts) and the indexes NFR3.13 lists; row-level policies (a parent reads and marks only their own; admins in reach list jobs via the function only) | BR40, NFR3.13 |
| Import: tables `import_runs`, `import_rows`, `import_staged_rows`, `import_conflicts`, `sheet_registry` (seeded with the 17 sheets by the migration); policies (only the starting super admin reaches runs and staged rows; staged rows readable by no other role, not even the service-role key) | BR41, NFR1.44 |
| The named functions: `notification_list`, `notification_mark_read`, `reminder_plan`, `reminder_run_due`, `reminder_list`, `reminder_retry`, `import_preview_create`, `import_conflict_resolve`, `import_commit`, `import_mark_interrupted`, `import_recover`, `import_status`, `import_cancel`, `import_expire`; each security definer with `SET search_path FROM CURRENT`, no execute for anon, caller checks as the rules' callers paragraph says, and an entry in the elevated-function catalogue | BR42.4, NFR1.51 |
| `create or replace` of U3's use-case functions on the hand-off list (and `event_save`, `settings_save`, `task_save`, `lifecycle_run`) adding the notification writes and job changes of BR40.9; `dashboard_import_conflicts` body replaced; U3's marker test inverted | BR40.9, BR41.12, BR42.5 |
| Privilege revokes: no table rights for the service-role key on U4 tables; execute only on the system-caller functions (`reminder_run_due`, `import_expire`) | NFR1.52 |

All files are forward-only; merged files are never edited (a correction note goes in the code summary).

## Application Configuration

| Item | Change | Rule |
|---|---|---|
| `next.config.ts` | `experimental.serverActions.bodySizeLimit` of 6 MB (in Next 16 the `serverActions` option is declared inside the experimental config) (application-wide; the import action enforces the 5 MB file limit itself) | NFR2.20 |
| `package.json` | One exactly pinned xlsx-reading library, chosen at code generation (read-only, no formula evaluation, minimal dependencies, passes the audit) and recorded with the alternatives in the code summary; no other new dependency | NFR2.19, NFR1.49 |
| `lint`, `format`, `format:check` lists | Add `src/import-parser/` (the server-only parser module) and any other new source folder; the scope-guard test enforces it | NFR2.27 |
| Environment variables | None added | assumption 1 |

## Test Data

A generator used only by tests creates the fictitious workbook from the template in the design (all 17 sheets; a '+36' phone, an invalid phone, a consent mark, duplicates and ambiguous matches, a formula cell, a very long cell; a zip-bomb-style file made in test code) and extends U3's data set with 3000 notifications and 600 reminder jobs inside a worker schema; it is deterministic, never reads `source-materials/`, and removes nothing outside its schema.

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | database | U4's tables, policies, functions, indexes, revokes | Same schemas as U1 to U3 |
| Sign-in service (Auth) | identity provider | Unchanged | Not used by U4 beyond the session |
| Mail server (Inbucket) | receives mail | Unchanged | Not used by U4 |
| Disabled services | Studio, storage, realtime, edge functions, analytics, pooler | Unchanged | U1 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Elevated function list and the service-role privilege list | U2 | U3, U4 (appends), U5 | The catalogue and privilege tests fail when an entry is missing |
| Notification writes inside U3's use cases | U3 (hook), U4 (writes) | U5 | Only inside the named functions |
| Test data generators | U3, U4 | U5 (seed uses its own) | Tests only |
