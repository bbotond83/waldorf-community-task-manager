# CI/CD Pipeline

## Validation Stages

CI runs format, type, unit, integration, authorization-matrix, and migration compatibility checks. Development deployment validates scoped directory reads, field restriction, immediate revocation, and redacted auditing. Production promotion is manual after the checklist and uses the already-tested immutable build.

## Change Recovery

Schema migrations are versioned and require forward-compatible rollout and documented rollback/recovery steps. Deployment rollback restores the prior application artifact; data rollback uses the approved migration or database recovery procedure, never an unreviewed destructive command. CI secrets remain in Vercel/Supabase secret stores.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
