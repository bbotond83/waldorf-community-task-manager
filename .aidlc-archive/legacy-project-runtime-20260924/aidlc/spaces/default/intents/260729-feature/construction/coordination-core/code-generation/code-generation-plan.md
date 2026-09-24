# Coordination Core Code Generation Plan

| Steps | Traceability |
|---|---|
| 1–2 | US-02, US-03, US-07; FR-05, FR-07; NFR-01, NFR-05 |
| 3–4 | US-02, US-03, US-07; FR-05; NFR-01, NFR-07 |

- [x] Step 1 — Define task, assignment, swap, repository, audit, and durable event contracts. *(FR-05, FR-07)*
- [x] Step 2 — Integrate linked-family eligibility through the family-directory public view boundary. *(FR-05; NFR-01)*
- [x] Step 3 — Implement optimistic signup and capacity checks within rollback-capable transactions. *(FR-05; reliability requirements)*
- [x] Step 4 — Implement confirmed atomic swaps and admin-pending swaps with redacted audit and `assignment.changed` events. *(FR-05; NFR-07)*
- [x] Step 5 — Add focused eligibility, capacity, rollback, confirmed-swap, and pending-swap tests. *(FR-05; NFR-05)*
