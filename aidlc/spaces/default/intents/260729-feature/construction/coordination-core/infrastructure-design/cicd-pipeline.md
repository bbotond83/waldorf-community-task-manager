# CI/CD Pipeline

## Validation Stages

CI runs type, unit, integration, authorization-matrix, capacity-concurrency, and idempotency tests. The development checklist validates assignment creation/change, cancellation and swap scope, duplicate suppression, audit redaction, and notification outbox behavior before manual production approval.

## Recovery Controls

Deployment artifacts are immutable and Vercel rollback is available for application regressions. Schema changes require compatible reads/writes and a documented recovery migration; production secrets remain in managed Vercel/Supabase stores, never in test fixtures or logs.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
