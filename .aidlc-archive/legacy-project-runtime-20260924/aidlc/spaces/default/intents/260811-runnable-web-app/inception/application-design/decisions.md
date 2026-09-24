# Architecture Decisions

## Decision Sources

These ADRs implement the current [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), CodeKB [architecture](../../../codekb/waldorf-community-task-manager/architecture.md), [component inventory](../../../codekb/waldorf-community-task-manager/component-inventory.md), and [team practices](../practices-discovery/team-practices.md), while retaining the approved `260729-feature` architecture.

## ADR-01 — Extend the Modular Monolith with a Next.js Delivery Layer

**Context:** The repository contains tested framework-independent domain modules but no browser application, composition root, or delivery adapter. The full inherited product must run locally and remain Vercel-compatible.

**Decision:** Add a Next.js App Router delivery layer, typed application façades, and one composition root around the existing domain modules.

**Consequences:** Existing rules remain reusable/testable and the missing end-to-end boundary becomes executable. Application façade and screen-model contracts add code but prevent UI/domain coupling. Production build is compatible with the approved target.

**Alternatives Rejected:** A separate demo app would violate full-product reuse and create throwaway behavior. Microservices add network consistency and deployment complexity without an independent-scaling need. Client-only access weakens authorization and privacy.

**Security/compliance:** Server-side authorization and minimized view models prevent client-only enforcement. **Reversibility:** Moderate; delivery can change while application/domain ports remain.

## ADR-02 — Select Synthetic or Production Adapters at One Composition Boundary

**Context:** Local acceptance must require no production credentials or personal data, while future Supabase/provider adapters must preserve identical application behavior.

**Decision:** `APP_RUNTIME_MODE` selects exactly one validated composition. Synthetic mode uses versioned invented fixtures and deterministic in-memory adapters. Production mode excludes synthetic routes/profiles and binds only configured production adapters.

**Consequences:** Full flows and failures are testable locally without false real-target claims. Adapter parity requires contract tests. Misconfiguration fails closed before serving protected routes.

**Alternatives Rejected:** A throwaway local UI would drift. Requiring production services locally would block reproducibility and privacy. Runtime mixing of both modes risks bypass.

**Security/compliance:** No real data or secrets enter fixtures/evidence; crafted synthetic endpoints are denied in production. **Reversibility:** Easy at adapter level.

## ADR-03 — Use Typed Application Results and Authorized Screen Models

**Context:** Existing modules expose heterogeneous return types and some thrown conflicts. Refined UX requires one explicit state vocabulary with exact retry, focus, announcement, and privacy behavior.

**Decision:** Application façades normalize domain results/exceptions into the shared `ApplicationResult<T>` union and emit already-authorized screen models.

**Consequences:** Routes/components become deterministic and QA can fixture every state. Mapping code must remain exhaustive and tested. Raw infrastructure errors never cross the boundary.

**Alternatives Rejected:** Mapping separately in each page duplicates policy. Exception-string branching is fragile and leaks implementation detail. A generic success/error union cannot represent conflict, invalidation, or retryability.

**Security/compliance:** Denial is non-enumerating and sensitive fields are absent, not hidden. **Reversibility:** Easy; internal domain types remain unchanged.

## ADR-04 — Preserve Synchronous Domain Calls and Durable Idempotent Follow-Up

**Context:** User operations need immediate outcomes, while reminders, import recovery, and lifecycle work must survive request boundaries.

**Decision:** Use synchronous in-process commands/queries for user requests and versioned events/jobs with idempotency keys for follow-up. Synthetic mode supplies deterministic in-memory queues; linked production uses durable adapters.

**Consequences:** Atomic user outcomes stay simple and background behavior remains replaceable. At-least-once delivery requires idempotent consumers and explicit stale/cancelled states.

**Alternatives Rejected:** Browser timers are not durable. Making every module asynchronous complicates immediate validation. Network RPC adds failure modes without value in one deployment unit.

**Security/compliance:** Event payloads are privacy-minimized and evidence redacted. **Reversibility:** Moderate; contracts remain stable across queue technologies.

## ADR-05 — Keep Deployment Outside the Local Runtime Intent

**Context:** The application must build/start locally before target linkage. Team practice allows future staging automation and requires protected manual production promotion.

**Decision:** Produce Vercel-compatible build output and local start smoke only. Keep executable deployment workflows disabled and perform no staging or production call in this intent.

**Consequences:** Local readiness is independently testable and cannot be confused with release evidence. Target-specific failures remain outstanding until a future linked workflow.

**Alternatives Rejected:** Deploying now contradicts scope and lacks linked targets. Adding AWS duplicates the approved Vercel/Supabase platform. Omitting production build would fail to validate deployability.

**Security/compliance:** No target credentials are required or stored. **Reversibility:** Easy; a later deployment pipeline consumes the tested artifact.

