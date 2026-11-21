# Observability Requirements: u13-lending-library

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains the actions of BR139.2 (book returned, changed or removed by a super admin, owner changed by a super admin, removal applied), and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | Audit entries of this Unit are read as audit entries are today; this Unit adds no new audit reader. | The existing audit read tests pass with an entry of each new action. |
| NFR4.6 | The two new notice kinds (`book_returned`, `book_return_due`) appear on the super admin's delivery-problems screen (U5) when an email fails, as it lists any kind, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.7 | The check `library_return_due` appears in the run record (`timed_check_runs`) with its outcome and counts, and a failure shows on the same screen as failed emails (contract C9). | A test runs the check, then forces a failure, and reads the record. |
| NFR4.8 | A refusal names its reason in the result envelope (BOOK_NOT_AVAILABLE, BOOK_NOT_ON_LOAN, BOOK_ON_LOAN, BOOK_AVAILABLE, BOOK_REMOVED, ALREADY_WATCHING, VERSION_CONFLICT and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.9 | A failed read or refusal shows the existing error or denied state, never an empty list: the library says there is no book only when the read succeeded and nothing is found. | A browser or component test covers each state. |
