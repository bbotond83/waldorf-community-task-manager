# Shared Infrastructure

## Shared Resources

Administration shares Vercel runtime, EU Supabase Auth/Postgres, RLS, audit, telemetry, secrets, and deployment controls. It calls owning domain services and does not bypass their authorization or data ownership.

## Ownership

The platform owns environments, backups, secret provision, alerts, and releases. Admin experience owns scoped UI projections, accessibility, and redacted operational feedback.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
