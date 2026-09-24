# Deployment Architecture

## Read-Only Runtime

The staff schedule is a Next.js route deployed on Vercel, backed by scoped read projections from EU-region Supabase. Development and production remain separate. The browser receives only a policy-filtered view model; server authorization and RLS prevent staff mutation routes and contact-data access.

## Release Controls

CI deploys to development, where role/scope and mobile schedule checks run before manual production approval. Immutable artifact rollback restores the prior UI without changing schedule data; RLS policy migrations require compatibility verification.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
