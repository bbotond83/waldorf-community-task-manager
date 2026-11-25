# Reliability Requirements: u12-todo-and-my-tasks

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9, C15, C16 and C17 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.18 | Every command is all-or-nothing: the task change, its history row, its notice and its audit entry commit together or not at all. | A forced failure midway leaves the task as before. |
| NFR7.19 | A pull is all-or-nothing: every checklist task, link and history row appears together or none does; a failure on one selected task rolls back the whole pull (BR185.1). | A forced failure on the last task leaves no checklist task, link or history row. |
| NFR7.20 | The database itself refuses a task with both or neither of a group and a family owner, a done status without a done time, a done time on another status, a "not before" date after the deadline, a duplicate source key, a duplicate link of one task to one event, and any history row change or delete. | A test tries each directly as the database owner. |
| NFR7.21 | The deadline check is safe to run twice the same day and sends each reminder once (BR188.2); an error on one task is noted in the run's detail and the others still run. A run stopped partway leaves nothing behind and can be started again. | A test runs it twice, counts notices, forces a per-task error and a whole-run failure. |
| NFR7.22 | Dates are compared in Budapest time: "not before", the deadline window, the week boundary on My tasks, including in the weeks where the clocks change. | Tests set the moment just before and after each boundary in both clock-change weeks. |
| NFR7.23 | `migration_load_todo` creates each source key once however often it runs, refuses a bad row with the field name only and does not stop the others (BR190.2). | A test loads the invented workbook twice and counts rows, and loads bad rows. |
| NFR7.24 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.9 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.10 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.11 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables and notice kinds. | The scripts name the file and both catalogue tests pass. |
| NFR6.12 | Functions that no screen of this Unit calls are tested directly: the removal pair, `migration_load_todo`, `checklist_task_done_state` and the deadline check. | A database test file calls each as the database owner. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.5 | The removal pair clears names on tasks and history, releases and flags a removed person's open claim, flags a removed family's open tasks, and returns zero counts for a subject that holds nothing (BR190.1). | A test calls the pair for a parent and for a family and reads the rows afterwards. |
| NFR11.6 | A flagged task, and a done task whose names were cleared, stay readable: they show "korábbi tag", never an error or a blank, and an owner family that was removed still shows without error. | A test reads each after a removal. |
| NFR11.7 | Today's duties page, the group page, U9's recurring screens and U11's template links keep working; only the temporary links move to the management page. | The existing tests pass unchanged or change in the same pull request. |
