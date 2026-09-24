# CI/CD Pipeline

## Validation

CI tests grace period, holds, deletion/anonymization idempotency, audit redaction, one-year cleanup, and administrator-only access. Development verification completes before manual production approval.

## Recovery

Vercel rollback restores the application while durable lifecycle work resumes from stored state. Secrets use managed stores; EU-region, controller, and DPA checks remain production gates.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
