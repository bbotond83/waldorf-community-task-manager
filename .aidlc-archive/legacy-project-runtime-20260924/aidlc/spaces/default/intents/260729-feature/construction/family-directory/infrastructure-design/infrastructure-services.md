# Infrastructure Services

## Data Services

Supabase Postgres stores family, parent, child, group, and school-year records in EU-region projects. Indexes support scoped family and group reads, while RLS and server-side policy checks enforce field-level restrictions. No cache stores contact or optional profile values in MVP; short-lived server response caching may be used only for non-sensitive scoped projections.

## Integration Boundaries

The directory uses the shared Auth, AuditWriter, and job infrastructure through typed domain contracts. Backups, point-in-time recovery where enabled, and migration records are configured on the production database; external providers receive no directory data except necessary recipient references through the jobs boundary.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
