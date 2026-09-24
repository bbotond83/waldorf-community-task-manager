# Access Foundation Code Generation Plan

## Scope and Traceability

This embedded library provides typed authorization and revocation contracts. A future Next.js route layer and Supabase adapter must call the policy before data retrieval and repeat its row predicate with RLS. No routes, migrations, or UI are generated because this repository has no existing application scaffold or Supabase project configuration.

| Steps | Traceability |
|---|---|
| 1–2 | US-06, US-12, US-13; FR-01, FR-03; NFR-01, NFR-05 |
| 3–4 | US-06, US-12, US-13; FR-01, FR-03; NFR-01, NFR-02e, NFR-07 |
| 5–6 | US-06, US-12, US-13; FR-01, FR-03; NFR-01, NFR-05 |
| 7 | FR-01; NFR-01, NFR-05 |

## Implementation Steps

- [x] Step 1 — Establish minimal strict TypeScript and test configuration. *(NFR-05)*
- [x] Step 2 — Define User, RoleGrant, Scope, Session, decision, audit, and repository contracts. *(FR-01, FR-03; NFR-01)*
- [x] Step 3 — Implement server-side role, scope, action, and field policy with Hungarian generic denial and protected super-admin governance. *(FR-01, FR-03; NFR-01)*
- [x] Step 4 — Implement grant/revocation with authorization-version invalidation and redacted audit events. *(FR-01; NFR-02e, NFR-07)*
- [x] Step 5 — Add in-memory adapters so the library is independently executable and defines persistence/audit seams. *(FR-01; NFR-01)*
- [x] Step 6 — Add role/resource/field, redaction, and immediate-revocation unit tests. *(FR-01, FR-03; NFR-01, NFR-05)*
- [x] Step 7 — Document public exports and defer Next.js/Supabase integration artifacts until their application boundary exists. *(FR-01; NFR-01)*
