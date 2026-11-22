# Tech Stack Decisions: u7-swaps-and-duty-changes

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file that rewrites the swap and cancellation functions | `team.md`; applied migrations are never edited |
| Structure | The existing `change_requests` table gains columns and statuses; no new table and no new index | One record per request; the one-open-request guarantee comes from the place locks and the active-status rule (BR71.3) |
| Versions | Stored place versions are taken after the pending mark, and applied versions at the end of the applying transaction | Lets acceptance and reversal compare exact versions (BR71.5, BR72.2) |
| Rota rules | U6's C11 functions are called in the same transaction; C11 gains a change with no family | Rota rules stay with RotaPlanning (ADR-011) |
| Places | C5 functions only, with one new internal `place_add` | Duties owns who holds a place |
| Notices | Five kinds registered in U5's registries by this Unit's migration; sent through `notice_send` | C8; U5's functions are not edited |
| Daily check | One registry row inserted by this Unit's migration; the function takes the moment of the run | C9; safe to run twice and testable without waiting |
| Time | Duty starts are compared in Budapest time inside the database | Matches the rest of the app |
| Screens | The existing Next.js app and `app/globals.css`, with the `parent-` and `admin-` class prefixes | The screens sit in the parent and administrator areas |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |

No new package, service or scheduler is added.
