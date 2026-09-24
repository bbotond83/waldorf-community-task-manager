# Parent Web Deployment Architecture

## Sources

Implements [performance](../../nfr-design/performance-design.md), [security](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md)/[services](../../../../inception/application-design/services.md), and [logic](../../functional-design/business-logic-model.md).

## Runtime

Parent/invitation routes are embedded in the single Next.js process and call selected session/parent façades. Synthetic mode provides deterministic profiles/duties/requests/notices/failures. No independent service or deployment.

## Isolation

Route groups share AppShell but not admin/staff protected state. Production-compatible output is built locally; synthetic entry is omitted in production composition; no target invocation occurs.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Parent routes are correctly embedded in the shared process, isolated from other protected state, dependent only on shared façade/runtime contracts, and backed by complete local CI checks. Synthetic evidence is labelled, linked-target/Safari evidence stays outstanding, and no independent service or deploy job exists.
