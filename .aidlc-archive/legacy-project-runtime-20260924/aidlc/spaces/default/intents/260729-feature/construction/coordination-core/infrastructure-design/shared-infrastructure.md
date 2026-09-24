# Shared Infrastructure

## Shared Resources

Coordination shares the EU database, Vercel runtime, authentication, audit writer, telemetry, and durable job infrastructure. It owns coordination tables and constraints; directory, access, and jobs interactions occur through IDs and application contracts rather than direct cross-unit writes.

## Operational Ownership

The platform owns deployment, backups, secret provision, alerts, and provider compliance checks. The coordination unit owns state-machine migration compatibility, transaction metrics, and domain recovery procedures. All production processing remains subject to EU region and approved provider configuration.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
