# Tech Stack Decisions: u10-events-and-signups

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; keeps every check on the database side |
| Structure change | `events` gains columns and loses the three notes and the coordinator name; the new tables are created beside it. No data is migrated (invented test data, local reset) | The earlier U1 decision; the data is test data |
| Notices | Three kinds and one target registered in U5's registries by this Unit's migration; sent through `notice_send` | C8; U5's functions are not edited |
| Text | Sign-up notes, dishes and notices are plain text with database length checks, escaped on output | No markup support is needed (NFR1.4) |
| Time | Event end and deadline are compared in Budapest time inside the database | Matches the rest of the app and can be tested without waiting |
| Screens | The existing Next.js app and `app/globals.css`, with `parent-` and `admin-` classes | No new area prefix is needed |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |
| Technical names | Keep `tasks` for duties and `assignments` for places | A rename adds risk and changes no behaviour |

No new package, service or scheduler is added.
