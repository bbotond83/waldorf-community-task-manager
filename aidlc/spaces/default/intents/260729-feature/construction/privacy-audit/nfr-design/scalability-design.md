# Scalability Design

## Retention Stores

Audit events are indexed by timestamp, event type, actor, and related entity for scoped administrative investigation. Partitionable retention queries and batch lifecycle processing avoid long transactions. Historical assignments retain anonymized identifiers required for statistics, while personally identifying contact and optional profile fields are removed.

## Capacity Signals

Monitor audit-table growth, lifecycle backlog, failed batches, and age of pending deletion candidates. The one-year audit retention job deletes or anonymizes eligible events unless a recorded investigation hold excludes them.

Sources: `../nfr-requirements/scalability-requirements.md`; `../nfr-requirements/performance-requirements.md`; `../functional-design/business-logic-model.md`.
