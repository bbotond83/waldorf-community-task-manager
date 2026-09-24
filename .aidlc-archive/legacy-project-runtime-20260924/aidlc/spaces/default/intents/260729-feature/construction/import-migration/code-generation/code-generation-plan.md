# Import Migration Code Generation Plan

- [x] Define immutable preview, staged-publish, rollback, changed-row, and consent contracts. *(US-08–US-10, US-12; FR-08–FR-12a)*
- [x] Validate stable source IDs and optional-profile consent before creating a preview. *(FR-04, FR-12)*
- [x] Bind commits to a preview fingerprint and atomically stage/publish visibility. *(FR-10, FR-11)*
- [x] Reconcile visibility after rollback and test stale, consent, changed-row, duplicate-commit, and rollback paths. *(FR-10, FR-11; NFR-05)*
