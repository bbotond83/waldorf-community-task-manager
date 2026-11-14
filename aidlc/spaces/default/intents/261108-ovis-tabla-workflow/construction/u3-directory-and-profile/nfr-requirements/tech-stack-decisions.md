# Tech Stack Decisions: u3-directory-and-profile

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, as forward-only migration files; each redefined function is redefined in U3's new migration | `team.md`; keeps every check on the database side |
| Directory read | One database function builds the cards and omits hidden fields; no view or client-side filter | ADR-008: a hidden field never leaves the database |
| Password and email change | Run through the sign-in service and the app server, outside the C1 template; the confirmation step is a service-role function | The service owns passwords and sign-in emails (BR33, BR34) |
| Links | 32 random bytes, SHA-256 hash stored, as `crypto.ts` does today | No new tool |
| Email | Nodemailer and the mail catcher, as invitations do today | No new package |
| Resend limit | A small attempt table counted in the database (3 per address per hour per kind), recorded only for accepted sends | Answer Q1; mirrors the existing sign-in attempt table |
| Retention | The existing housekeeping step deletes finished email-change requests after 30 days | Answer Q2; no new scheduler |
| Screens | The existing Next.js app and `app/globals.css`, with `parent-` and `admin-` classes as `team.md` requires | No new area prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool |

No new package, service or scheduler is added.
