# Monitoring Design: u14-removal-and-anonymisation

Sources: `observability-design.md`, `security-design.md`, `reliability-design.md`, `performance-design.md`, `scalability-design.md` and `logical-components.md` of this Unit, its `functional-spec.md`, `components.md` and `contract-summary.md`. There is no hosted monitoring in this work. Contains no names or contact details.

| Signal | Source | Where it is seen | Threshold or action |
|---|---|---|---|
| Removal and later-run audit rows | `platform_audit_write` | Database; audit screens | Every removal has one row with per-step counts |
| Flags left by removal | Owning areas | Flagged duties, library, to-do list, recurring duties, the removal result page | Stay until handled |
| Failed session end | Server log (code, account id) | Local server output | Retried once; warning line on the result page |
| Unexpected removal error | Server log (operation, code, request id) | Local server output; general error state on screen | Nothing written; administrator retries |
| Families waiting for delete or anonymise | Data-lifecycle screen | Admin area | Listed once past 30 days |
| Timing | Database and browser tests | Test output | Preview, removal, result page and later run under 2 seconds |

No dashboards or alerts are added.
