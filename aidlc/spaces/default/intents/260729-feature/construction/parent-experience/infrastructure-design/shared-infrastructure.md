# Shared Infrastructure

## Shared Resources

Parent experience shares Vercel runtime, EU Supabase Auth/Postgres, RLS, telemetry, and deployment tooling. It consumes policy-enforced directory and coordination projections and owns no contact store, authorization bypass, or notification-provider credential.

## Ownership Boundaries

The shared platform owns projects, secrets, backups, deployments, and alerts. Parent experience owns accessible rendering, family-scoped view models, and privacy-safe performance signals; domain units own all mutations.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
