# Reliability Design

## Job State Machine

Jobs move through `scheduled`, `leased`, `delivered`, `retry_scheduled`, `cancelled`, and `dead_letter` states. A lease timeout makes abandoned jobs claimable again. Idempotency keys and conditional state transitions ensure that a crash, duplicate scheduler tick, or retry cannot create a second active notification.

## Failure Recovery

Transient provider failures retry at 5, 30, and 120 minutes. After the third retry, the job is dead-lettered with a redacted reason and administrative alert. Cancellation and assignment changes atomically mark stale reminders cancelled before new reminders are scheduled.

Sources: `../nfr-requirements/reliability-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
