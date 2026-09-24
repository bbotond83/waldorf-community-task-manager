# Application Facades Security Design

## Sources

Implements [security requirements](../nfr-requirements/security-requirements.md), [technology decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Pipeline Controls

Each public method executes a fixed pipeline: schema validation, session freshness, matrix authorization, domain invocation, exhaustive outcome classification, allowlisted projection, redacted evidence. A failure stops subsequent stages. Authorization denial precedes repository-backed domain calls.

## Mapping Boundary

Dedicated mappers translate known validation, authorization, conflict, and invalidation values. Adapter ports expose a typed failure classification; unexpected throws are caught and converted to terminal failure unless a reviewed classifier explicitly proves safe retry. No mapper branches on localized message text.

## Projection and Redaction

View-model factories require an `AuthorizedContext` and field-set ID. They create new immutable objects from allowlists, never spread raw aggregates. Evidence/event factories accept redacted identifiers and enumerated summaries only. Runtime assertions reject forbidden keys in development/tests.

## Idempotency

An injected idempotency store records operation, actor, key, input fingerprint, pending/terminal result. Same key/different input is validation conflict. Same key/same input returns the stored result. Only retryable dependency failure may re-enter the operation and retains the original key.

## Verification

Contract tests instantiate malicious/faulting ports and assert no data leakage, no unauthorized domain call, unchanged state, exhaustive classification, identical-key behavior, next-request revocation, and redacted events/evidence.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The fixed pipeline, typed mapping boundary, authorized allowlist projections, injected idempotency store, malicious-port verification, and logical component isolation form a coherent transport-neutral defense. Failure domains are bounded and no Next.js, environment, database, or concrete adapter dependency leaks into the library.
