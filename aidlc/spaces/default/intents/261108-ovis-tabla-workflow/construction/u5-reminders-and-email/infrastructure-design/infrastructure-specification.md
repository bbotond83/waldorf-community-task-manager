# Infrastructure Specification: u5-reminders-and-email

Nothing is hosted; the app and database run on the owner's computer (`team.md` Deployment). This Unit adds no cloud resource. It changes the database structure, adds one command, one mail path and one scheduled-run contract for the later hosting work.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: Next.js app on the owner's computer, plus a new command `npm run timed:run -- daily\|friday_noon\|deliver` run by hand | ADR-006; hosting and its schedule are separate later work |
| Networking | Unchanged: local stack answers on loopback only; the command reaches the database and the mail catcher on loopback | Project correction on the local stack's ports |
| Storage strategy | One local Postgres; one new forward-only migration file | `team.md`: applied files are never edited |
| Environments | Local only | No staging or production exists |
| IaC approach | SQL migration plus app code; no cloud templates | Nothing to provision |
| Schedule (for hosting later) | `daily` at 07:00 and `friday_noon` at 12:00 Friday, Budapest time; `deliver` every 15 minutes | BR52.4, BR52.6; recorded so hosting work wires the same command |
| Resource sizing | About 40 parents, a few thousand rows a school year | `scalability-design.md` |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | Database | Registry tables for notice kinds (with Hungarian label), target types and timed checks (with `lock_step`, rejected when missing), all written only by the migration; `reminder_jobs.due_on` date column; delivery table (status, round, tries in round, next attempt, claimed time) and attempt table (round, try, outcome, reason class); timed run and check-run tables (outcome, created and skipped counts, error code); indexes of `performance-design.md`; the simulated attempt table dropped; grants in three lists: service role only: `timed_checks_run_system`, the claim, the expiry sweep, the outcome record; signed-in role (body-checked): notice list, mark read, delivery-problems list, Try again; no application role: `notice_send`, facts, check and housekeeping functions (called only by same-owner `security definer` code); every new function `revoke all` then explicit `grant execute`, search path pinned; delivery, attempt, run and check tables have row-level security on and no select for application roles, read only through the screen's list function | One migration file, own transaction |
| Timed command | Runs the daily checks and delivery passes | `scripts/` TypeScript using `createAdminAccess` from `src/identity/admin-client.ts` and `SERVICE_ENV_FILE` from `scripts/db/common.ts`, as `scripts/db/first-super-admin.ts` does (`SUPABASE_SERVICE_ROLE_KEY`); neither the command nor the notice mailer may import `server-only`; a `timed:run` entry is added to `package.json`; calls the run function, then loops claim, send, record (batches of 10, 50 per pass, 2-minute limit, one overall 30-second send timeout); prints counts-only lines; exits non-zero on a failed check or failed email | No new setting |
| Mail catcher | Delivers the notice emails in tests and by hand | Existing local catcher through nodemailer; existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` and `APP_PUBLIC_URL`; new notice mailer in `src/identity/mail.ts` beside the invitation mailer | No new variable |
| Housekeeping | Pruning | New registered check `housekeeping` deletes deliveries and tries after 90 days and run and check records after 30 days; the existing `identity_housekeeping()` is untouched | Runs in the daily run |
| Seed and reset | Invented data | `scripts/db/reset.ts` makes one daily-run call before emptying, replacing its per-organization system-tick call, and `scripts/db/seed/commands.test.ts` changes in the same pull request; seeds register the existing kinds and target types through the migration | Test addresses go in `scripts/verification/privacy-allowlist.json` |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| `notice_send` (C8) | u5-reminders-and-email | U6, U7, U8, U9, U10, U11, U12, U13 | Internal database function, called by feature functions; never by a session |
| Notice kind and target type registries | u5-reminders-and-email | Every unit that sends notices | Rows added by each unit's own migration; each target type brings its facts function |
| Timed check registry and `timed_checks_run_system` (C9, amended in this pull request: `lock_step` column, error code, outcome `missing`) | u5-reminders-and-email | U6, U7, U9, U10, U11, U13 and the hosting schedule | Service role only; each unit's migration supplies `lock_step` when it registers a check |
| Notifications removal step (C16) | u5-reminders-and-email | U14 | Internal database functions, called from lifecycle functions only |
| Audit log | u1-community-foundation | All Units | Not used by this Unit |
