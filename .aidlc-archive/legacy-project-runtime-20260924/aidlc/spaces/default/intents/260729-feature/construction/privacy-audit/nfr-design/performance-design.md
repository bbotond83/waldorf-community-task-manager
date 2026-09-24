# Performance Design

## Lifecycle Processing

The lifecycle runner identifies eligible families after the 30-day grace period with indexed status and date queries, then processes contact deletion and historical anonymization in small idempotent batches. Interactive administration reads a status projection rather than executing retention work inline.

## Verification

Use fixtures for departure, hold, grace expiry, and large historical assignment sets. Measure lifecycle batch duration and administrative status-query p95, and verify that retention work cannot degrade protected application reads beyond the shared targets.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
