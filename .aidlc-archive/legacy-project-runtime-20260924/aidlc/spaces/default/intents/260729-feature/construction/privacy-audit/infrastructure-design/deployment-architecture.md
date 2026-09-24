# Deployment Architecture

## Lifecycle Runtime

Vercel server workers run authorized lifecycle and audit operations against EU-region Supabase Postgres. Development and production projects are isolated; audit and retention endpoints are unavailable to browsers and restricted to approved administrator roles.

## Release Controls

CI deploys immutable artifacts to development. Manual production approval follows retention, hold, audit-redaction, and recovery checks; application rollback preserves durable lifecycle state for safe resumption.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
