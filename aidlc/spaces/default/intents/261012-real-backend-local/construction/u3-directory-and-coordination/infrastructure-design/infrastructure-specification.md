# Infrastructure Specification: U3 Directory, settings and coordination

No hosted infrastructure is created or changed and no deployment workflow is added. U3 reuses the local stack of U1 and U2 and adds database objects and tests. Source: `infrastructure-design-questions.md` (assumptions confirmed), the functional design, the NFR requirements, and U1's and U2's infrastructure specifications.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: containers on Docker Desktop started by the pinned Supabase CLI; the web app runs as before | Nothing new to deploy |
| Networking | Unchanged: published ports checked by `db:start` for non-loopback exposure (U1) | U1 decisions stand |
| Environments | Local development and CI only | No deployment workflow before a deployable application and a linked target exist (team rule) |
| Infrastructure as code | New SQL migration files only; `supabase/config.toml`, `.env.example` and the workflow's environment values are unchanged | One mechanism, as U1 and U2 |
| Mail | Unchanged; U3 sends no email (notifications are U4) | Scope |

## Database Changes (new migration files, applied by U1's runner in the default and the four worker schemas)

| Change | Rule |
|---|---|
| Tables for Directory, Settings and Coordination as in `entities.md`, each with `organization_id`, row-level policies and the indexes NFR3.6 lists | BR30, BR31, NFR3.6 |
| The named kernel use-case functions (rules.md preamble and the port table in functional-spec.md), each security definer with `SET search_path FROM CURRENT`, no execute for anon, and an entry in the elevated-function catalogue | BR32.6, NFR1.27 |
| `create or replace` versions of U2's functions that read `app_families` and `app_assignments` (invitation create and its replacement, the session and scope helpers, the access-change functions), reading the new tables with the group reach defined in `entities.md`; U2's identity tests re-run | NFR1.32 |
| A catalogue check, then (only if nothing still names them) the drop of `app_families` and `app_assignments` in a later migration file | NFR6.14 |
| Privilege revokes: no table rights for the service-role key on U3 tables; execute only on the lifecycle and invitation functions it needs | NFR1.28 |
| The unique constraints and partial indexes the rules need (one non-removed assignment per family and task, one open request per assignment, one account per parent, one membership per family and group) | BR31.2, BR31.4, BR30.3 |

All files are forward-only and numbered after U2's last migration; merged files are never edited (a correction note goes in the code summary).

## Test Data

A generator used only by tests creates a 150-family, 10-group, 300-task, 1500-assignment data set inside a worker schema for the timing and race tests (NFR3.5, NFR4.6); it is deterministic, creates its own accounts with the worker prefix, and removes nothing outside its schema. The seed itself is U5.

## Application Settings

None added. The existing settings (database address, keys, session secret, `APP_PUBLIC_URL`, SMTP) are unchanged.

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | database | U3's tables, policies, functions, indexes, revokes | Same schemas as U1 and U2 |
| Sign-in service (Auth) | identity provider | Unchanged | The lifecycle deactivates accounts through U2's function |
| Mail server (Inbucket) | receives mail | Unchanged | Not used by U3 |
| Disabled services | Studio, storage, realtime, edge functions, analytics, pooler | Unchanged | U1 |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Elevated function list and the service-role privilege list | U2 | U3 (appends), U4, U5 | The catalogue and privilege tests fail when an entry is missing |
| Directory and Coordination tables and functions | U3 | U4 (notifications and import read and extend them), U5 | Only through the named functions; U4 adds its notification writes inside U3's use cases (BR31.10) |
| Test data generator | U3 | U4, U5 | Tests only |
