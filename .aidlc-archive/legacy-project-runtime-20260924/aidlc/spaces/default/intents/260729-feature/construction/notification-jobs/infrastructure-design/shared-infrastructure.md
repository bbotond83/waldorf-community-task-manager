# Shared Infrastructure

## Shared Resources

Notification jobs share Vercel server runtime, EU Supabase Auth/Postgres, audit conventions, secrets, and alert transport with the modular monolith. The jobs unit owns queue tables and state transitions; coordination producers call its typed interface after committed changes.

## Operational Ownership

The shared platform owns deployment, provider credentials, database backups, and alert routing. Jobs owns its delivery SLOs, retry/dead-letter recovery, and privacy-safe operational projections. Provider-region validation remains a production gate.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
