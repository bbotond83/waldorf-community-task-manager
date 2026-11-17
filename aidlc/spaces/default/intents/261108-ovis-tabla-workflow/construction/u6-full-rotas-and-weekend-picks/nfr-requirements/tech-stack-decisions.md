# Tech Stack Decisions: u6-full-rotas-and-weekend-picks

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, as one new forward-only migration file | `team.md`; keeps every check on the database side |
| Draft | The turn-taking rule runs inside the database function, with a fixed order and no random choice | A repeated draft gives the same result (BR61.3) and needs no extra tool |
| Flagged duties | Computed by the read functions from standings and dates; no flag column | One source for each fact; nothing to clean up when a standing or the changeover date changes (BR60.5) |
| Weekend places | Moved with the existing internal `place_reassign` of U2 | Reuses the tested place change instead of a second way to change a holder (BR63.9) |
| Time | Wednesday, Friday noon and Saturday boundaries are computed in Budapest time in the database, from the moment the run or the command passes in | The run already takes a moment (C9), so boundaries can be tested without waiting |
| Notices and checks | Rows in U5's notice-kind and daily-run registries, added by this Unit's migration; sent through `notice_send` | C8 and C9; U5's functions are not edited |
| Scheduling | The local command `npm run timed:run` triggers the daily and Friday-noon runs | No scheduler exists yet (`technology-stack.md`); a real schedule is hosting work |
| Screens | The existing Next.js app and `app/globals.css`, with `admin-` and `parent-` classes | No new area prefix is needed |
| Tests | The existing database, Vitest and Playwright suites; the draft grid runs in the database tests | No new tool is needed |
| Technical names | Keep `tasks` for duties and `assignments` for places | A rename adds risk and changes no behaviour |

No new package, service or scheduler is added.
