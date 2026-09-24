# Admin Core Deployment Architecture

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md)/[services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Runtime

Admin core routes are embedded in the single Next.js modular-monolith process and use the selected composition/façades. No independent service, database, queue, or deployment exists. Synthetic mode supplies deterministic admin profiles/data/failures.

## Route Isolation

Server route groups enforce admin session/scope. Panel/detail/action failures remain within their route region. Production-compatible output is built locally; target deployment is disabled.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Administrator core is correctly embedded in the shared runtime with route-local failures, deterministic synthetic data, presentation-only reusable shell contracts, and no private state leakage to advanced routes. Its CI gate covers scoped workflows and evidence while prohibiting target secrets and deployment jobs.
