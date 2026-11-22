# Observability Requirements: u7-swaps-and-duty-changes

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.4 | The audit action list gains `swap.reversed` and `duty.reassigned`, and past audit events stay readable. | A test applies the change over an audit row of each existing kind. |
| NFR4.5 | Audit entries of this Unit are read as audit entries are today; this Unit adds no new audit reader. The administrator's swap list is the record of agreed swaps. | The existing audit read tests pass with an entry of each new action. |
| NFR4.6 | The five new notice kinds (`swap_withdrawn`, `swap_expired`, `swap_cancelled`, `swap_reversed`, `duty_reassigned`) appear on the super admin's delivery-problems screen (U5) when an email fails, with no address. | A test fails a delivery in the local test mailbox set-up and reads the list. |
| NFR4.7 | The check `swap_expiry` appears in the run record (`timed_check_runs`) with its outcome and counts, and a failure shows on the same screen as failed emails (C9). | A test runs the check, then forces a failure, and reads the record. |
| NFR4.8 | A refusal names its reason in the result envelope (SWAP_SLOT_FOLLOWS_WEEK, REQUEST_DUPLICATE, DUTY_INELIGIBLE, ROTA_SAME_WEEK_CLASH, SWAP_CANNOT_BE_APPLIED, SWAP_REQUEST_NOT_OPEN, SWAP_EXPIRED, SWAP_CHANGED_SINCE, CANCELLATION_EXPIRED, DUTY_CLOSED, VERSION_CONFLICT, REQUEST_VERSION_STALE and the denied refusal) so the screen can explain it and the tests can assert it. | Each refusal code has a test that asserts the code. |
| NFR4.9 | A failed read or refusal shows the existing error or denied state, never an empty list: the swaps page says there is no request only when the read succeeded and nothing is found. | A browser or component test covers each state. |
