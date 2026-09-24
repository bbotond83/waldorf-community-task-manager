# Import Migration Code Summary

## Delivered

- `src/import-migration/` creates snapshot-style immutable previews with changed-row lists and a stable fingerprint.
- Optional profile fields are rejected without recorded consent.
- Commit requires the exact preview fingerprint, stages before publish in one transaction, and rejects replayed/stale commits.
- Rollback invokes post-import reconciliation and marks the preview rolled back.

## Validation

- `npm test` — 32 tests passed.
- `npm run typecheck` — passed.
