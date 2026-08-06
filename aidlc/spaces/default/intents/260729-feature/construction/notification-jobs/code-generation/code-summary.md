# Notification Jobs Code Summary

## Delivered

- `src/notifications/` schedules paired in-app and email outcomes for 7-day and 24-hour duty thresholds.
- A due duty created/rescheduled after a threshold receives an immediate, revision-scoped catch-up outcome only once.
- Email uses durable job IDs as provider idempotency keys. Providers that cannot honor them are explicitly surfaced as `at_least_once`; failed sends are `retry_scheduled`.
- Tests cover threshold/catch-up, deduplication, idempotency outcome, privacy-safe status, and a DST-boundary instant.

## Validation

- `npm test` — 23 tests passed.
- `npm run typecheck` — passed.

## Boundary

This unit provides domain scheduling only. A later worker owns persistent retry dispatch, recipient resolution from directory links, and email provider integration.
