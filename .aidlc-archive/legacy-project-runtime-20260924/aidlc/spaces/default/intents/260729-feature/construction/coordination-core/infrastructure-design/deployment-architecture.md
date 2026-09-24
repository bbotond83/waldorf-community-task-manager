# Deployment Architecture

## Transactional Runtime

Coordination commands run in server-side Next.js handlers on Vercel and execute transactional domain services against EU-region Supabase Postgres. Development and production are isolated projects; browser clients use role-limited sessions and cannot invoke privileged state transitions directly.

## Release Boundaries

Immutable builds deploy to development after CI and are manually promoted to production after task, signup, swap, and cancellation verification. Rollback restores the prior application artifact; migrations use a separately reviewed forward/recovery plan to preserve assignment integrity.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
