# Tech Stack Decisions: u9-recurring-duties

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; keeps every check on the database side |
| Structure | Two new tables (schedules, occurrences) beside the existing ones; no existing table changes and no duty or place is created for an occurrence | The design's deviation from "occurrences are duties" (ADR-003); avoids a change to U7 |
| Daily check | `recurring_due_check(now)` registered in U5's `timed_check_registry` by this Unit's migration | C9; U5's function is not edited |
| Notices | Two kinds and one target type registered in U5's registries; sent through `notice_send` with once keys from schedule and due date | C8 |
| Rota family | Read live through `rota_family_for` | C12; no write to U7's rows |
| Text | Titles, categories and skip reasons are plain text with database length checks, escaped on output | No markup support is needed |
| Time | All dates and windows are computed in Budapest time inside the database | Matches the rest of the app and can be tested without waiting |
| Starting list | Added to the existing seed script with invented Hungarian titles | FR9.4 to FR9.6; real titles are replaced by the owner in the app |
| Screens | The existing Next.js app and `app/globals.css`, with a new `recurring-` class prefix beside `parent-` and `admin-` | `team.md`: new areas get their own prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |

No new package, service or scheduler is added.
