# Administrator Advanced Web Deployment Architecture

## Sources

Implements [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Runtime

Import, reminder, governance, lifecycle, and settings routes run inside the single Next.js modular-monolith process and call the selected admin façade. Synthetic composition supplies deterministic workbook previews, conflict/recovery state, job attempts, grants/session invalidation, lifecycle candidates/outcomes, recipients, provider outcomes, and classified failures. The unit creates no independent compute, database, object storage, queue, scheduler, cache, network, or deployment lifecycle.

## Isolation

Advanced routes reuse the authorized administrator shell and shared runtime contracts without reaching admin-core private route state. Workflow stores and job/provider/session/audit adapters remain behind the synthetic composition root. Production-compatible output is built and started locally; synthetic controls are absent from production composition; no Supabase, provider, Vercel, staging, or production target is invoked.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent (inline fallback)

**Verdict:** READY

Advanced workflows use deterministic in-process stores/adapters behind the composition root, reuse only presentation contracts from admin core, and require no independent cloud resource. The CI design exercises high-risk recovery/security states, blocks severe findings, records outstanding linked-target evidence, and contains no deploy job or target credential.
