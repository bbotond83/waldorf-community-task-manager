# Shared Infrastructure

## Shared Resources

Import migration shares Vercel runtime, EU Supabase Auth/Postgres, short-lived storage, telemetry, audit conventions, and deployment controls. It owns staging tables, parser workers, import-run state, and cleanup policy; committed records transfer through owning domain services.

## Ownership Boundaries

The platform owns secrets, backups, deployments, and alert routing. Import owns validation capacity, retention cleanup, transactional recovery, and redacted operational status. No raw import source is shared outside this unit's controlled processing path.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
