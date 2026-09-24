# Parent Web Security Design

## Sources

Implements [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [logic](../functional-design/business-logic-model.md).

## Design

Invitation token is handled server-side and converted to enumerated privacy-safe state; resend always returns identical visible success. Parent loads/actions authorize linked family and field before projection. Server actions validate origin/input/version/idempotency. Models use allowlists; automated DOM/accessibility-tree scans assert unrelated/contact/protected fields absent.

## Failure Controls

Conflict/full/ineligible/invalidated are business states without retry. Only reviewed dependency failure exposes retry with original key. Denial/terminal error focuses state and contains no raw exception/resource oracle.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Bounded server models, one-object detail queries, targeted revalidation, server-side invitation and linked-family authorization, allowlisted projections, classified retry, route-local failure, and protected-cache isolation implement the parent targets without introducing client policy or cross-surface coupling.
