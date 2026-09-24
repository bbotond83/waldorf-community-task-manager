# Deployment Architecture

## Isolated Import Runtime

Vercel server routes accept authorized import commands and start background parser workers; durable import state and staging rows live in EU-region Supabase Postgres. Source files use restricted short-lived staging storage. Development and production use separate projects, schemas, and secrets.

## Release Boundaries

Immutable builds deploy to development after CI. Production promotion is manual after upload, preview, conflict-resolution, commit, rollback, and recovery verification; application rollback does not discard durable import state.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
