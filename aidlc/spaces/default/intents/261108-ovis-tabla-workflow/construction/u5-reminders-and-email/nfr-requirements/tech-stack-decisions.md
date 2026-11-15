# Tech Stack Decisions: u5-reminders-and-email

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md`, `contract-summary.md`, ADR-006 and ADR-007.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, as forward-only migration files; each redefined function is redefined in U5's new migration | `team.md`; keeps every check on the database side |
| Registries | Notice kinds, target types and timed checks are rows written only by migration files, validated by `notice_send` | C8 and C9; later units register without editing U5 |
| Titles and links | A facts function per target type returns name, date, path and optionally a full title (which replaces the kind prefix plus name); called by name from the registry with the name quoted; not executable by signed-in roles | Each unit owns its item facts; no shared function to edit; state-dependent titles work |
| Delivery | Rows queued in the database; a claim function with `for update skip locked` and a record function; the app's timed command sends with the existing mail adapter | ADR-006 and ADR-007; no new service; no address stored |
| Email | Nodemailer and the local mail catcher, through a notice mailer beside the invitation and account mailers in `src/identity/mail.ts` | No new package |
| Scheduling | `npm run timed:run -- daily|friday_noon|deliver`, using the server-only service access; hosting runs the same command on a schedule later | ADR-006; hosting is separate work |
| Time | The Budapest calendar date, fixed once per run and passed to every check | C9 |
| Retention | The registered check `housekeeping` prunes: run, check and email records pruned by the daily run's housekeeping check: 30 days for run and check records, 90 days for email records and tries | Answer Q1; no new scheduler |
| Pass size | At most 50 emails per pass, claimed in batches of 10, 30-second send timeout, no new batch after 2 minutes | Answer Q2 |
| Screens | The existing Next.js app and `app/globals.css`, with `admin-` and `parent-` classes as `team.md` requires | No new area prefix |
| Tests | The existing database, Vitest and Playwright suites; a fake mail transport for application tests and the local mailbox for one integration check | No new tool |

No new package, service or scheduler is added.
