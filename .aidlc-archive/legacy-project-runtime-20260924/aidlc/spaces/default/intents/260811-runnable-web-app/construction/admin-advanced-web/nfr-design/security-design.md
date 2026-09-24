# Administrator Advanced Web Security Design

## Sources

Implements [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Authorization and Input Design

Each loader/action names an authorization-matrix row, resolves the current session, validates role/scope/object/field authority, and only then reads or parses privileged input. Import uses size/type guards, safe workbook parsing, required-sheet/header validation, normalized allowlisted values, immutable fingerprint, explicit conflict resolution, expected preview state, and one idempotent commit. The browser holds only opaque preview/run/job/grant/family IDs and safe projections.

## Mutation and Revocation Design

Reminder retry is permitted only for classified retryable jobs and reuses the original correlation identity. Grant changes enforce authority, expected version, last-super-admin and self-lockout invariants, then invalidate all affected synthetic sessions before returning success. Lifecycle actions re-evaluate eligibility/version inside the command boundary and atomically apply deletion/anonymization plus redacted audit outcome. Origin validation, output encoding, safe errors, and exhaustive application states apply to every command.

## Verification Design

Table-driven role/scope tests cover missing navigation and direct denial, crafted IDs, malformed workbooks, preview/fingerprint/conflict/duplicate/recovery states, reminder retry classification, stale/self-lockout/last-admin grant cases, next-request revocation, lifecycle blockers and repeat execution, XSS, field absence, and response/DOM/accessibility/log/screenshot/evidence redaction.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Server-owned bounded previews, immutable fingerprints, single-use idempotent commit, classified job retry, grant/session invalidation, lifecycle re-evaluation, output safety, exhaustive tests, and route-level failure domains satisfy the high-risk advanced workflows. Adapters and workflow stores remain behind façades and synthetic results cannot imply linked-target success.
