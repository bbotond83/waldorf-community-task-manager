# CI/CD Pipeline

## Validation Stages

CI validates parsing, malformed input handling, scope authorization, preview versioning, idempotent commit, rollback, corrected re-import, and redacted audit logging. Development verification uses non-production fixture files and checks one-hour recovery behavior before manual production approval.

## Release Recovery

Vercel artifacts are immutable and reversible; database migrations require forward compatibility and documented recovery. Vercel/Supabase managed secrets protect workers and storage access. EU-region, controller, DPA, and provider checks remain production gates.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
