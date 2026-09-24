# Shared Infrastructure

## Shared Resources

Staff schedule shares Vercel runtime, EU Supabase Auth/Postgres, RLS, telemetry, and deployment infrastructure. It consumes only the coordination schedule projection and owns no assignment-mutation infrastructure.

## Ownership Boundaries

The platform owns credentials, projects, deployments, backups, and alert routing. The schedule UI owns accessible read-only rendering and scoped latency metrics; coordination remains the sole owner of schedule mutations.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
