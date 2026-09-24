# Deployment Architecture

## Administrative Runtime

Admin routes deploy on Vercel and use EU Supabase via authenticated server handlers, policy checks, and RLS. Development and production projects are separate; sensitive administration projections never expose privileged credentials to browsers.

## Release Controls

CI deploys to development, with manual production approval after role/scope, import, audit, and administration-flow checks. Immutable artifacts permit UI rollback without unreviewed data changes.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
