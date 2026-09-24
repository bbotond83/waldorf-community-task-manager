# Application Facades Security Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), [business rules](../functional-design/business-rules.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Requirements

- Authorize named matrix row, scope, action, resource, and field before retrieval or mutation.
- Construct allowlisted view models; prohibited fields never enter delivery props or serialized responses.
- Treat stale authorization version as denial and clear protected cache on the next request.
- Normalize equivalent entry-point input through shared schemas and stable error codes.
- Require idempotency keys and expected versions for consequential mutations; duplicates create at most one effect.
- Map exceptions once into retryable or terminal dependency results; raw errors never cross the boundary.
- Emit redacted events/evidence without contacts, optional profiles, protected reasons, free text, secrets, or resource oracles.
- Keep synthetic/linked-target status explicit; local simulation cannot pass real RLS/provider/deployment checks.

## Verification

Table-driven tests cover every role with route/action/resource/field allow and deny, immediate revocation, UI/API parity, unchanged denied/failed state, field absence, audit/log redaction, retry classification, and idempotency. Coverage is at least 80% lines/branches/functions.

## Threat Boundary

The library trusts neither delivery input nor adapter output. It accepts validated transport-neutral values, calls public domain ports, and validates/maps returned data before projection. It never reads environment variables, cookies, HTTP objects, React components, or concrete database clients.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The requirements define an enforceable authorization, projection, idempotency, error, evidence, and revocation contract while keeping the library transport/framework neutral. Verification is table-driven and quantitative, and technology choices preserve strict TypeScript, public module ports, independent typechecking, and required coverage.
