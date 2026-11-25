# Tech Stack Decisions: u12-todo-and-my-tasks

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; keeps every check on the database side |
| Structure | Three new tables (`todo_tasks`, `todo_task_history`, `todo_event_links`); no column is added to any existing table | Keeps each record with its owner |
| Reads over other units | `my_tasks_get` calls the existing duty read and U9's `recurring_my_occurrences`; the management page calls the C14 list functions | No second copy of any list; no change to those units |
| Read added to Checklists | An internal read `checklist_task_done_state` in U12's migration | U11 is merged and the read only reads (owner answer Q1) |
| Notices | Two kinds registered with a new `todo_task` target and facts function, sent through `notice_send` | C8; U5's notice functions are not edited |
| Daily check | One row in U5's registry, run kind daily, lock step 4 | C9; no scheduler is added |
| Load | `migration_load_todo`, service role only, keyed by source key | C17; U15's script calls it |
| Text | Topic, description, materials and note are plain text with database length checks, escaped on output | No markup support is needed (NFR1.10) |
| Time | The not-before day, the deadline window and the week boundary are compared in Budapest time inside the database | Matches the rest of the app and can be tested without waiting |
| Screens | The existing Next.js app and `app/globals.css`, with a new `todo-` class prefix | `team.md`: a new area gets its own prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |

No new package, service or scheduler is added.
