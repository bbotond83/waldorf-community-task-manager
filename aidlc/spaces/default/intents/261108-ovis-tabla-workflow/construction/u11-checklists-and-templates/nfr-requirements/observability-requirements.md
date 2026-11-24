# Observability Requirements: u11-checklists-and-templates

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.12 | The audit action list gains the actions of BR170.3 (template removed, template restored, claim removed, done undone, removal applied), and past audit entries stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.13 | The two daily checks record their created and skipped counts, and the detail of a failed event, in U5's run record, shown on the super admin's screen with the failed emails (C9). | A test runs the checks and reads the run record. |
| NFR4.14 | The two new notice kinds (`event_lead_time`, `checklist_unclaimed`) appear on the super admin's delivery-problems screen (U5) when an email fails, as it lists any kind, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.15 | A refusal names its reason in the result envelope (TEMPLATE_UNAVAILABLE, CHECKLIST_NOT_EMPTY, EVENT_CLOSED, TASK_TAKEN, ALREADY_CLAIMED, TASK_DONE, TASK_NOT_CLAIMABLE, TASK_HAS_CLAIMS, SECTION_HAS_CLAIMS, CHECKLIST_TASK_UNAVAILABLE, VERSION_CONFLICT, the field refusals and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.16 | A failed read or refusal shows the existing error or denied state, never an empty list: an event says it has no checklist, and the templates list says it is empty, only when the read succeeded and nothing is found. | A browser or component test covers each state. |
