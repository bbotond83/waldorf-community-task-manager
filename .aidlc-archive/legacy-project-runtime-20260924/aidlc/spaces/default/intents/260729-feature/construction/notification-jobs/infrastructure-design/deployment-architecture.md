# Deployment Architecture

## Worker Runtime

Vercel hosts authenticated scheduler and worker endpoints alongside the Next.js application; durable job state remains in EU-region Supabase Postgres. Development and production use distinct projects. Workers receive only server-side secrets and resolve recipient references only during approved provider delivery.

## Release Boundaries

CI deploys the immutable worker/application artifact to development for timing and retry verification. Manual production approval follows the checklist; rollback restores the prior artifact while jobs remain durable and recover through leases rather than being lost.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
