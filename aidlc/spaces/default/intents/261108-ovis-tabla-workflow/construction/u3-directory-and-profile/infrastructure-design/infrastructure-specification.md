# Infrastructure Specification: u3-directory-and-profile

Nothing is hosted; the app and database run on the owner's computer (`team.md` Deployment). This Unit adds no new service, container or cloud resource. It changes the database structure, one mail path and one housekeeping step.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Unchanged: Next.js app on the owner's computer | No hosted site exists; hosting is separate later work |
| Networking | Unchanged: local stack answers on loopback only; start command keeps its non-loopback check | Project correction on the local stack's ports |
| Storage strategy | One local Postgres; changes arrive as one new forward-only migration file | `team.md`: applied files are never edited |
| Environments | Local only | No staging or production exists |
| IaC approach | SQL migration plus app code; no cloud templates | Nothing to provision |
| Resource sizing | About 20 families, a few dozen rows per list | `scalability-design.md` |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Postgres | Database | New profile table; `email_change_requests` table with partial unique index (one pending per account) and unique token hash; `email_send_attempts` table (kind, keyed address hash, sent time) with index on (kind, hash, sent time); unique index on active parent email on record; audit action constraint widened by 8 names; contacts read rule narrowed; new named functions each with `revoke all` then explicit `grant execute`; `email_change_request`, `email_change_cancel` and `email_change_confirm` granted to the service role only (the server checks the password first); `migration_load_family` (C17) also service role only; lifecycle anonymisation and account-status functions redefined (NFR11.1, NFR11.3); old free-text columns copied then dropped (NFR7.4); indexes on family and parent ids for the directory read (NFR9.2); one advisory lock key from the hashed address, taken before any family lock, in add-parent, add-family, email edit, email request, email confirmation and the resend limit, with lock order family, parent, request (NFR5.4, NFR5.6); the resend limit's keyed hash resets if the keyed-hash secret changes (accepted locally); `email_change_confirm` runs with rights on the sign-in service's email tables and is refused with a logged reason when the service-role key is missing; a test shows a signed-in account cannot read any new table directly; the three new tables have row-level security on and select granted only where a screen needs it: the profile table to signed-in accounts through its reach helper, the other two to nobody (read only inside functions), so no read can expose a pending address (NFR1.3) | One migration file, own transaction |
| Sign-in service | Password check and change, ending other sessions, email confirm | Existing local service; relies on the service-role key, `APP_PUBLIC_URL`, `SMTP_HOST`/`SMTP_PORT` and the keyed-hash secret already in use; no new setting | Event lines gain 4 names (an invitation mail failure reuses `email_change_mail_failed` with a kind field) |
| Mail catcher | Delivers invitation, email-change link and change notice | Existing local catcher through nodemailer; existing `SMTP_FROM` | No new variable |
| Housekeeping | Scheduled clean-up | Existing database function `identity_housekeeping()`; the new migration redefines it starting from the latest version (`20261047_community_foundation.sql`), keeping every existing deletion and its grant, and adds two deletions: finished email-change requests older than 30 days (clock: `decidedAt`, or `expiresAt` for expired) and send-attempt rows older than 24 hours | Runs where today's step runs |
| Seed and reset | Invented data | Seed and `db:seed:large` gain the new profile fields and invented sharing values | No real names or contacts |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| `directory_list` function (no contract in `contract-summary.md`; any later consumer needs one) | u3-directory-and-profile | None named | Read function; session check inside |
| Removal preview and apply (C16) | u3-directory-and-profile | U14 | Internal database functions, called from lifecycle functions only |
| Family load `migration_load_family` (C17) | u3-directory-and-profile | U15 | Service role only |
| Audit log | u1-community-foundation | All Units | Insert through the audit function only |
