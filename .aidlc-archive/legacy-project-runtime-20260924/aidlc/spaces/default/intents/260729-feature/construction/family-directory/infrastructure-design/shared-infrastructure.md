# Shared Infrastructure

## Shared Resources

Family directory shares EU Supabase Auth/Postgres, Vercel server runtime, audit infrastructure, and telemetry with the other modular-monolith units. RLS policies and schema ownership keep family records isolated from coordination, import, and privacy writes; cross-unit references are IDs and flow through application services.

## Ownership Boundaries

The directory unit owns its tables, indexes, migrations, and scoped projections. The shared platform owns authentication transport, secret provisioning, backups, deployment artifacts, alert transport, and redacted logging conventions. Production data region and provider compliance remain release gates.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
