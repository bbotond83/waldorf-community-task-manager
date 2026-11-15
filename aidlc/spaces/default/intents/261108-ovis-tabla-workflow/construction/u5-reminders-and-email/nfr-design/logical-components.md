# Logical Components: u5-reminders-and-email

Sources: the other NFR design artifacts of this Unit, `functional-spec.md` and `technology-stack.md`. No new service or infrastructure; only logical parts of the existing app and database.

| Component | Where | Failure domain and blast radius | NFR patterns applied |
|---|---|---|---|
| Notice API (`notice_send`, `notification_list`, mark read) | Postgres functions | Inside the caller's transaction; a refusal rolls back the calling feature | outbox, community join, once keys, facts functions |
| Registries (kinds, target types, checks) | Postgres tables, migration-written | Shared by all units; a bad row breaks only its kind | migration-only writes, name constraint |
| Facts functions | Postgres functions, one per target type, owned by the unit that adds the type | An error shows "Törölt tétel" for that notice only | facts-only output, shared leak test |
| Delivery queue (delivery, attempt tables, claim, record) | Postgres | A stuck row waits for expiry; others proceed (`skip locked`) | outbox, skip locked, 3-try rounds, claim expiry |
| Daily run (`timed_checks_run_system`, run and check tables) | Postgres function | One check fails alone; the run continues | sub-block isolation, one moment per run |
| Duty-reminder check | Postgres function | Own sub-block; failure is recorded | ascending job locks, once keys |
| Housekeeping check | Postgres function | Own sub-block | retention 90 and 30 days |
| Failure view (list, Try again) | Postgres functions and `admin-` screen | Super admins only | stale token, idempotency key, ascending locks |
| Removal step (C16) | Postgres functions | Called by U14 inside its transaction | row locks, preview equals apply |
| Timed command (`npm run timed:run`) | Next.js app scripts | A crash leaves claimed rows to expire in 10 minutes | batches of 10, 30-second timeout, counts-only output |
| Notice mailer | `src/identity/mail.ts` | A failed send is a recorded try | error mapping, fixed template, one recipient |

Shared resources: the Postgres database and the local mail server. A mail outage stops only the timed command's sends; the app, notices and runs continue.
