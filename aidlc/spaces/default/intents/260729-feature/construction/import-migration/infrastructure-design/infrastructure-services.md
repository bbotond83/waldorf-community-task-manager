# Infrastructure Services

## Staging Services

EU Supabase Postgres stores durable import runs, normalized staging rows, conflicts, state transitions, and commit idempotency keys. Indexed import ID, row state, and normalized keys support paged preview and duplicate detection. Parser workers process bounded batches; raw source data is short-lived and never enters logs.

## Recovery Boundaries

The commit service uses transactional domain writes and supports recorded rollback, corrected preview, and re-import. Shared audit and job services receive redacted state summaries only. Browser clients never receive privileged storage or database credentials.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
