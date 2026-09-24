# Business Rules

## Validation

- Unresolved required identity or mapping conflict blocks confirmation.
- Hostile/unsupported input is rejected before parsing.
- Canonical identity and row hash make reprocessing idempotent.

## Commit Rules

- Commit is atomic and bound to immutable preview/hash/version.
- Rollback/recovery actions require authorized administration and redacted audit evidence.
