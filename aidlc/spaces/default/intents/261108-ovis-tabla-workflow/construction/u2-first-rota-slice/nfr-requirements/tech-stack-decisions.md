# Tech Stack Decisions: u2-first-rota-slice

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, as forward-only migration files | `team.md`; keeps every check on the database side |
| Draft order | A fixed rule in the database function (families by name, rotating start by year), no random choice | A repeated draft gives the same result (BR21.3) and needs no extra tool |
| Time | Week start and end are computed in Budapest time in the database | Duties run Monday 00:00 to Sunday 23:59:59 local time (BR20.4) |
| Screens | The existing Next.js app and `app/globals.css`, with new `admin-` and `parent-` classes as `team.md` requires | No new area prefix is needed |
| Notices | Today's notices table gains kind `rota_published` and target `rota_plan`, and its task link and start time may be empty for that kind only (a check keeps them required for every other kind). The dedupe key is `rota_published:<plan id>:<parent id>` | Contract C8 and the notification function arrive in U6; today's table requires a task and allows only the targets `task` and `change_request`, so those checks must change |
| Tests | The existing database, Vitest and Playwright suites; an invented workbook is not involved | No new tool is needed |
| Technical names | Keep `tasks` for duties and `assignments` for places | A rename adds risk and changes no behaviour |

No new package, service or scheduler is added.
