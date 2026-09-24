# Family Directory Code Generation Plan

## Scope and Traceability

The directory is an embedded TypeScript service that owns family relationships and field-filtered views. It consumes the access unit through its `authorize` and active-grant interfaces; it does not alter access ownership, Supabase configuration, or shared audit contracts.

| Steps | Traceability |
|---|---|
| 1–2 | US-01, US-05, US-12; FR-01, FR-03, FR-05a; NFR-01, NFR-02c |
| 3–4 | US-01, US-05, US-12; FR-01, FR-03, FR-05a; NFR-01, NFR-02e, NFR-07 |
| 5–6 | US-01, US-05, US-12; FR-01, FR-03; NFR-01, NFR-05 |

## Implementation Steps

- [x] Step 1 — Define owned family, parent, child, scoped relationship, repository, view, and audit contracts. *(FR-01, FR-03, FR-05a)*
- [x] Step 2 — Implement transactional in-memory repository support with rollback-safe relevance-projection bookkeeping. *(FR-01; NFR-01)*
- [x] Step 3 — Implement authorized save/link/assign/archive/restore commands, duplicate and cross-organization validation, projection refresh, and redacted directory audit events. *(FR-01, FR-05a; NFR-01, NFR-02e, NFR-07)*
- [x] Step 4 — Implement field-filtered family views: linked parents receive no contact, locality, or optional-profile data; in-scope administrators receive authorized fields. *(FR-03; NFR-02c)*
- [x] Step 5 — Add focused tests for authorized/unauthorized views and mutations, duplicate/cross-scope validation, transactional projection behavior, and sensitive-field filtering. *(FR-01, FR-03; NFR-01, NFR-05)*
- [x] Step 6 — Update the shared test command so all unit tests execute and document the integration boundary. *(NFR-05)*
