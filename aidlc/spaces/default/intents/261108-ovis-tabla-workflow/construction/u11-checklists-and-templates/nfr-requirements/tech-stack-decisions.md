# Tech Stack Decisions: u11-checklists-and-templates

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; keeps every check on the database side |
| Structure | Seven new tables (template, template section, template task, checklist head, checklist section, checklist task, claim); no column is added to `events` | Keeps the event row with its owner, U10 |
| Changes to other units | A new migration replaces `task_save_core` (no event link) and `event_save_core` (helpers also get the cancellation and change notice); both keep the rest of their behaviour | Owner answer Q1 and the design review; forward-only, so the old files are not edited |
| Starting templates | An internal install function in the migration holds the content; the seed calls it | Ships with the database, so the later hosting work gets the same templates |
| Notices | Two kinds registered with U10's `event` target, sent through `notice_send` | C8; U5's and U10's notice functions are not edited |
| Daily checks | Two rows in U5's registry, run kind daily, lock step 4 | C9; no scheduler is added |
| Text | Template texts, task fields, notes and typed names are plain text with database length checks, escaped on output | No markup support is needed (NFR1.7) |
| Time | Lead time, deadline and event dates are compared in Budapest time inside the database | Matches the rest of the app and can be tested without waiting |
| Screens | The existing Next.js app and `app/globals.css`, with a new `checklist-` class prefix for the checklist and template areas | `team.md`: a new area gets its own prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |
| Technical names | Keep `tasks` for duties; the checklist rows are named `checklist_tasks` and `checklist_claims` | Avoids confusing the two kinds of task |

No new package, service or scheduler is added.
