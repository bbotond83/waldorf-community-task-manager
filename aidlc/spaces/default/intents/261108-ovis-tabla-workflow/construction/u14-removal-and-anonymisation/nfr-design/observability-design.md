# Observability Design: u14-removal-and-anonymisation

Sources: this Unit's `observability-requirements.md`, `security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md` and `tech-stack-decisions.md`, its `functional-spec.md`, and contract C16 in `contract-summary.md`. Contains no names or contact details.

## Design

| Signal | Where | Content | Covers |
|---|---|---|---|
| Audit row | `platform_audit_write`, same transaction | action, subject id, per-step cleared and flagged counts, number of ended accounts | NFR4.3 |
| Flags | Owning screens: flagged duties, library, to-do list, recurring duties | Stay until handled | NFR4.4 |
| Result page list | `removal_flagged_items`, filtered to items whose reason is the removed family (or the removed parent's held books and released tasks), so a leaving family's flags elsewhere do not appear | Title, date, link | NFR4.4 |
| Server log | The removal server action | On an unexpected error: operation name, code, request id; on a failed session end: code and account id. Never a name or a text | NFR4.5 |
| Screen | General error state of the admin area | "Az eltávolítás nem sikerült, semmi sem változott." | NFR4.5 |

No hosted monitoring exists in this work, so there are no dashboards or alerts.
