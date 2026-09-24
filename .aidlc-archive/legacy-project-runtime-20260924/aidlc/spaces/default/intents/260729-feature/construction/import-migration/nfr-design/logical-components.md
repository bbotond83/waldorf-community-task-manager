# Logical Components

## Components

- **Import command API** authorizes upload, creates immutable import runs, and returns progress identifiers.
- **Parser and validator worker** normalizes rows, applies reference rules, and writes conflicts to staging.
- **Preview and resolution service** pages validated rows and records administrator conflict decisions.
- **Commit and rollback service** converts an approved preview to domain writes atomically and logs a redacted summary.

## Operational Interfaces

The import state projection exposes `uploaded`, `parsing`, `preview_ready`, `committing`, `committed`, `failed`, and `rolled_back` states. Telemetry reports durations, row counts, and failure categories without persisting raw source values.

Sources: `../nfr-requirements/tech-stack-decisions.md`; `../nfr-requirements/reliability-requirements.md`; `../functional-design/business-logic-model.md`.
