# Observability Requirements: u10-events-and-signups

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 and C8 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains the actions of BR123.1 (event cancelled, organiser marked or unmarked, sign-up or offer removed by a manager, typed name cleared, removal applied), and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | Audit entries of this Unit are read as audit entries are today; this Unit adds no new audit reader. | The existing audit read tests pass with an entry of each new action. |
| NFR4.6 | The three new notice kinds (`event_new`, `event_cancelled`, `event_changed`) appear on the super admin's delivery-problems screen (U5) when an email fails, as it lists any kind, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.7 | A refusal names its reason in the result envelope (EVENT_CLOSED, VERSION_CONFLICT, FOOD_SIGNUP_OFF, the limit refusals, no_typed_name and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.8 | A failed read or refusal shows the existing error or denied state, never an empty list: the events list says there are no events only when the read succeeded and nothing is found. | A browser or component test covers each state. |
