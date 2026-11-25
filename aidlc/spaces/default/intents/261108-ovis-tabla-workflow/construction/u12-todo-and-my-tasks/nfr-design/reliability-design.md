# Reliability Design: u12-todo-and-my-tasks

Nothing is hosted, so no availability design applies. Reliability here means data integrity, safe repeats and clean failure.

| Requirement | Design |
|---|---|
| NFR7.18 | Each command is one function in one transaction: task change, history row, notice and audit row commit or roll back together. |
| NFR7.19 | `todo_pull_to_event` does all checklist tasks, links and history rows in one transaction; any failure raises and rolls back everything. |
| NFR7.20 | Table constraints: owner is exactly one of group or family; done status iff a done time; not-before not after deadline; unique source key; unique (task, event) link; a trigger refuses update and delete on `todo_task_history`. Tested directly as the database owner. |
| NFR7.21 | The daily check marks each reminder with a once key per task and deadline; every task runs in its own sub-block so one error is noted in the run detail and the rest continue; a failed run leaves nothing behind. |
| NFR7.22 | Day boundaries use `Europe/Budapest` in SQL (`at time zone`), tested the moment before and after each boundary in both clock-change weeks. |
| NFR7.23 | `migration_load_todo` upserts by source key, refuses a bad row with the field name only and continues with the others. |
| NFR7.24 | Everything runs through `npm run verify:local`; recovery after merge is a new forward-only migration. |
| NFR6.9–NFR6.12 | Application code keeps 80/80/80 coverage; the test plan lists the fixed six cases per rule; each new database test file is added to its `test:database:*` script and the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended; the internal functions are called directly as the database owner. |
| NFR11.5 | The removal pair clears names on tasks and history, releases and flags an open claim of a removed person, flags a removed family's open tasks, and returns zero counts when nothing is held. |
| NFR11.6 | Reads join display names with a fallback to "korábbi tag" and an owner-family fallback, so a flagged or cleared task never errors or shows blank. |
| NFR11.7 | Existing pages keep their classes and tests; only the temporary links move to the management page. |
