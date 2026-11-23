# Observability Requirements: u9-recurring-duties

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains the actions of BR152.1 (schedule saved, switched on or off, occurrence marked done, undone or skipped, removal applied), and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | Audit entries of this Unit are read as audit entries are today; this Unit adds no new audit reader. | The existing audit read tests pass with an entry of each new action. |
| NFR4.6 | The check `recurring_due_check` is registered in U5's registry and its runs (created, skipped, outcome, error code) appear on the super admin's screen of check runs; a failing run shows there. | A test forces a failure and reads the run list. |
| NFR4.7 | The two new notice kinds (`recurring_due`, `recurring_overdue`) appear on the super admin's delivery-problems screen (U5) when an email fails, as it lists any kind, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.8 | A refusal names its reason in the result envelope (RECURRING_CLOSED, RECURRING_UNDO_TOO_LATE, VERSION_CONFLICT, the validation fields and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.9 | A failed read or refusal shows the existing error or denied state, never an empty list: a list says there are no duties only when the read succeeded and nothing is found. | A browser or component test covers each state. |
