# Application Facades Code Generation Plan

## Scope

Implement the transport-neutral application boundary shared by every web surface. The unit wraps existing domain public APIs, enforces the approved authorization and sensitive-field contract before retrieval/projection, provides exhaustive application results, and supplies deterministic synthetic adapters without importing React, Next.js, HTTP, environment variables, or concrete production clients.

## Plan

- [x] **Step 1 — Define shared application contracts and view-model primitives.** Add `ApplicationState`, `ApplicationResult<T>`, stable error/presentation codes, session/authorized context, retry/evidence/event/idempotency types, role-specific screen models, and exhaustive helpers with denied/retry invariants. Trace: US-LR-00, US-LR-03, FR-LR-03/14, NFR-LR-05/06.
- [x] **Step 2 — Implement the executable authorization matrix and sensitive-field dictionary.** Version named role × scope × route × action × resource × field rows, generic denial mapping, navigation projection, scope predicates, immediate authorization-version checks, and allowlisted sensitive-field identifiers. Trace: US-LR-00/02/03/06h, FR-LR-05/07/14.
- [x] **Step 3 — Implement validation, outcome mapping, and authorized projection utilities.** Normalize transport-neutral inputs with stable error IDs, classify known domain outcomes and adapter failures, construct immutable allowlisted models without aggregate spreading, and reject forbidden keys in development/tests. Trace: US-LR-06h, US-12, NFR-LR-05/06.
- [x] **Step 4 — Implement idempotency, event/job, and evidence ports with synthetic adapters.** Add deterministic in-memory idempotency coordination, clock/ID ports, privacy-minimized application events, job/evidence envelopes, duplicate handling, and strict synthetic `PASS` versus linked-target `OUTSTANDING` status. Trace: US-LR-00/04/06c/06d/06e/06f/07, FR-LR-03/10a, NFR-LR-05.
- [x] **Step 5 — Implement session/identity and authorization façades.** Resolve/select/switch synthetic sessions through injected gateways, build role navigation, authorize named matrix rows before domain calls, implement revocation version invalidation, and provide non-enumerating invitation/resend contracts while keeping runtime cookie/HTTP mechanics outside the library. Trace: US-LR-02/03/04e/06g, FR-LR-04/05/06/07/14.
- [x] **Step 6 — Implement Parent and Staff application façades.** Wrap existing Directory, Coordination, Parent Experience, Notifications, and Staff Schedule public contracts; map duty/request/notification/note/schedule outcomes into authorized screen models; ensure unrelated-family/contact/protected fields and all Staff mutations are structurally absent. Trace: US-LR-04a–04f, US-LR-05, inherited US-01–04/07/13.
- [x] **Step 7 — Implement Administrator façade contracts and workflow adapters.** Provide core records/tasks/assignments/approvals/archive/note queries and commands plus import/reminder/governance/lifecycle ports, exact approval/recovery/failure mappings, Group Administrator import denial before invocation, and deterministic synthetic workflow adapters where existing public APIs need application-facing composition. Trace: US-LR-06a1–06h, inherited US-05–12.
- [x] **Step 8 — Add Standard-strategy unit and contract tests.** Create colocated/table-driven tests for result invariants, every role allow/deny/navigation row, field absence, no unauthorized domain invocation, malicious/faulting ports, stable normalization, idempotency duplicates/fingerprint mismatch/retry, next-request revocation, redacted events/evidence, Parent/Staff/Admin representative success plus at least two edge/failure cases per component. Trace: US-LR-00/07/08 and NFR-LR-02/05/06.
- [x] **Step 9 — Enforce library isolation and integrate with runtime composition.** Export stable barrels, add forbidden-import/dependency tests or lint boundaries, connect the runtime synthetic composition through ports without moving HTTP/session-cookie responsibilities into façades, preserve existing domain module tests, and avoid circular dependencies. Trace: US-LR-00/02/03, application architecture boundaries.
- [x] **Step 10 — Validate and summarize the façade unit.** Run format, lint, strict typecheck, domain/delivery tests, coverage, and production build; fix unit-owned failures; mark steps complete; document files, key mappings, evidence/coverage, and deviations in `code-summary.md`. Trace: Bolt 1 definition of done and NFR-LR-02/06.

## Boundaries

- No React, Next.js, cookies, request/response, environment parsing, database client, or provider client enters this library.
- Domain modules retain ownership of rules, aggregates, repositories, and transactions; façades call public contracts only.
- Expected failures return explicit results; raw exceptions and prohibited fields never cross the application boundary.
- No package publication, executable deployment workflow, or target network action is added.
