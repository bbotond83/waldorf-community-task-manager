# Admin Core Web Security Design

## Sources

Implements [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Controls

Route loaders/actions name matrix row and scope, validate transport input, then call façades. Server-rendered models contain only allowed routes/actions/fields. Client components receive opaque IDs/versions and cannot widen scope.

Every mutation uses origin-protected server action, expected version, idempotency key, pending disable, exhaustive result render, and targeted revalidation. Protected reasons/event notes are separate authorized projections. Group Admin import paths are absent from nav and denied directly.

## Verification Design

Table-driven profiles exercise Group/Kindergarten/Super allow/deny cases, outside scope, sensitive fields, crafted IDs, stale/revoked sessions, duplicated submissions, approval seven outcomes, XSS input, accessible-tree leakage, and log/evidence redaction.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Independent bounded panels, stable pagination, targeted revalidation, matrix-named loaders/actions, opaque client identifiers, version/idempotency controls, exact approval outcomes, table-driven negatives, and component failure domains provide an implementable design with no protected shared client state or advanced-to-core dependency.
