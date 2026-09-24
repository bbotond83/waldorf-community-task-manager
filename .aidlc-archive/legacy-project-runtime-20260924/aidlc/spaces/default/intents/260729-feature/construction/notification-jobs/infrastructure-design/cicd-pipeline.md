# CI/CD Pipeline

## Validation Stages

CI tests idempotent scheduling, leased claims, retry timing, cancellation of stale reminders, dead-letter handling, and redacted payload/log behavior. Development verification uses clock-controlled jobs and a safe mail-provider test configuration before manual production approval.

## Recovery Controls

Deployments use immutable Vercel artifacts and retain durable queue state across rollback. Secrets stay in managed Vercel/Supabase stores; provider configuration and EU-processing/DPA evidence are checked as production release prerequisites.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
