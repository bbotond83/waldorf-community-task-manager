# Observability Design: u12-todo-and-my-tasks

The app runs only on the owner's computer, so there is no monitoring, alerting or SLO. Observability means audit, run records and readable refusals.

| Requirement | Design |
|---|---|
| NFR4.20 | The audit action check constraint is replaced by one that adds `todo.claim_freed`, `todo.done_undone`, `todo.pulled_to_event`, `todo.removal_applied` and `todo.migration_loaded`; old rows stay valid and a test applies it over a row of each existing kind. |
| NFR4.21 | The daily check writes created and skipped counts and per-task error detail to U5's run record, which the super admin's screen already shows. |
| NFR4.22 | `todo_changed` and `todo_due` register with U5's notice registry, so a failed delivery appears on the delivery-problems list without an address. |
| NFR4.23 | Refusals use the result envelope with named codes (TODO_CLAIMED, TODO_DONE, TODO_NOT_DONE, TODO_NOT_CLAIMED, TODO_NOT_YET, EVENT_CLOSED, VERSION_CONFLICT, the field refusals, the denied refusal and the others the rules name); each code is added to the code-to-message table and asserted in a test. |
| NFR4.24 | The pages distinguish read failure, denied and empty states; "Most nincs feladatotok." shows only after a successful empty read. |
| NFR4.25 | Every command writes a `todo_task_history` row with kind, old and new status, actor kind and time. |
