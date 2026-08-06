# Scalability Design

## Staged Batches

Parsing writes normalized rows and conflicts to import-scoped staging tables in bounded batches. Indexes on import ID, row state, and normalized external keys support paging and duplicate detection without loading an entire workbook into memory. Commit processing streams accepted rows in transactions sized for database limits.

## Capacity Signals

Monitor queued imports, parse memory, batch duration, and staging-table growth. The MVP handles administrator-driven workbook imports; sustained queueing or batch saturation leads to additional worker capacity rather than a change in import semantics.

Sources: `../nfr-requirements/scalability-requirements.md`; `../nfr-requirements/performance-requirements.md`; `../functional-design/business-logic-model.md`.
