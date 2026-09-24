# Staff Web Deployment Architecture

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Runtime

Staff list and detail routes run inside the single Next.js process and call the selected session and staff façades. Synthetic mode supplies deterministic profiles, group grants, schedules, revocations, empty states, and classified failures. The unit has no independent compute, storage, network, cache, queue, or deployment lifecycle.

## Isolation

The staff route group shares only the application shell, runtime composition, and authorized application contracts. Production-compatible output is built and started locally; synthetic entry is excluded from production composition; no Vercel, Supabase, provider, staging, or production target is invoked by this intent.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Staff routes require no independent compute, storage, queue, cache, or network service and consume only authorized shared contracts. CI covers all read/deny/privacy/accessibility/performance states and separates synthetic from outstanding real-target evidence without adding deployment.
