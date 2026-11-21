# Observability Design: u13-lending-library

Sources: `observability-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1, C8 and C9 in `contract-summary.md`. The app runs only on the owner's computer, so there is no metric store, alert or SLO; the design reuses the three places the project already looks: the audit list, the delivery-problems screen and the timed-run record.

## Design

| Need | Design | Serves |
|---|---|---|
| Audit actions | The migration adds the actions of BR139.2 (book returned, changed or removed by a super admin; owner changed by a super admin; removal applied) to the audit action list as new values only, so past events stay readable. A test applies the change over an audit row of each existing kind. | NFR4.4 |
| Audit reading | No new reader. The existing audit read shows the new actions; its tests gain one entry of each. | NFR4.5 |
| Failed emails | The two notice kinds `book_returned` and `book_return_due` are registered in U5's registry, so the delivery-problems screen lists them like any other kind, without an address. A test fails a delivery in the local test mailbox set-up. | NFR4.6 |
| Daily check record | `library_return_due` appears in `timed_check_runs` with outcome and counts; a failure shows on the same screen as failed emails. A test runs the check, forces a failure and reads the record. | NFR4.7 |
| Refusal reasons | Every refusal comes back in the result envelope with its code (BOOK_NOT_AVAILABLE, BOOK_NOT_ON_LOAN, BOOK_ON_LOAN, BOOK_AVAILABLE, BOOK_REMOVED, ALREADY_WATCHING, VERSION_CONFLICT, denied). A single table in the copy module maps each code to a Hungarian text; each code has a test that asserts it. | NFR4.8 |
| Error states | A failed read or refusal uses the existing error or denied state. The empty-library text is shown only when the read succeeded and returned no book, so an error is never shown as "no books". | NFR4.9 |

## Logging

The list and get reads also return the result envelope with the data beside it, so a denied or failed read shows as a refusal and never as an empty list. No new log stream. Functions raise only for faults and use the result envelope for expected refusals; the application boundary maps unexpected errors as it does today. No log line contains a title, name or contact detail.

## Alerting and Dashboards

None: nothing is hosted. When hosting work starts it will need the failed-delivery and timed-run records, which already exist.
