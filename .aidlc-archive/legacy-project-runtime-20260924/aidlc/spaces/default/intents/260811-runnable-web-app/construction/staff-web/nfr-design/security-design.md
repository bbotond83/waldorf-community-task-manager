# Staff Web Security Design

## Sources

Implements [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Authorization Design

The server resolves the session, validates filters, authorizes the Staff role and granted group, authorizes each row or detail key, and only then invokes the allowlisted projection. A dedicated staff façade returns explicit ready, empty, denied, retryable, or terminal results; React components never receive repositories, domain aggregates, grant stores, or raw exceptions.

## Privacy and Failure Controls

Projection constructors enumerate permitted schedule fields and make sensitive fields structurally unavailable. Generic denial contains no counts, identifiers, or existence oracle. Retry is available only for classified dependency failure; validation and authorization are non-retryable until input or access changes. Tests scan responses, DOM, accessibility output, logs, and screenshots for forbidden fields and verify next-request revocation.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

The design bounds schedule queries, centralizes authorization/projection in the façade, structurally excludes sensitive fields and mutation paths, preserves URL context without a protected client store, and contains failures to one request/route. Its measurement and negative scans directly verify the approved performance and privacy targets.
