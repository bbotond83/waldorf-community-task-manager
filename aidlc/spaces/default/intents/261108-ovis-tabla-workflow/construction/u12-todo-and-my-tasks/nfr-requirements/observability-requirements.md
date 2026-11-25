# Observability Requirements: u12-todo-and-my-tasks

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.20 | The audit action list gains `todo.claim_freed`, `todo.done_undone`, `todo.pulled_to_event`, `todo.removal_applied` and `todo.migration_loaded`, and past audit entries stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.21 | The deadline check records its created and skipped counts and the detail of a failed task in U5's run record, shown on the super admin's screen with the failed emails (C9). | A test runs the check and reads the run record. |
| NFR4.22 | The new notice kinds (`todo_changed`, `todo_due`) appear on the super admin's delivery-problems screen (U5) when an email fails, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.23 | A refusal names its reason in the result envelope (TODO_CLAIMED, TODO_DONE, TODO_NOT_DONE, TODO_NOT_CLAIMED, TODO_NOT_YET, EVENT_CLOSED, VERSION_CONFLICT, no_parent_record, too_many_tasks, status_not_allowed, the field refusals and the denied refusal) so the screen can explain it and the tests assert it. | Each refusal code has a test that asserts the code. |
| NFR4.24 | A failed read or refusal shows the existing error or denied state, never an empty list: the list says it is empty and My tasks says "Most nincs feladatotok." only when the read succeeded and found nothing. | A browser or component test covers each state. |
| NFR4.25 | Every history row carries the kind of change, old and new status, actor kind and time, so a task's story can be read without the audit log (BR184.2). | A test reads the history after each command. |
