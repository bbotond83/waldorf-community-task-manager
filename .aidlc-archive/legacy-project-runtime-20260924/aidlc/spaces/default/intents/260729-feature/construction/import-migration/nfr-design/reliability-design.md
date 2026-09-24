# Reliability Design

## Atomic Commit

An import remains `preview_ready` until an administrator explicitly commits the reviewed version. Commit runs through a transactional application service: it either creates all accepted domain records and the audit summary, or rolls back. Idempotency keys prevent a repeated commit request from duplicating records.

## Recovery Path

Failures leave the prior production data untouched and retain a diagnosable preview state. Administrators use rollback where a committed batch must be reversed, then correct the source and create a fresh preview/re-import. Worker crashes are resumable from persisted import state, with redacted failure diagnostics.

Sources: `../nfr-requirements/reliability-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
