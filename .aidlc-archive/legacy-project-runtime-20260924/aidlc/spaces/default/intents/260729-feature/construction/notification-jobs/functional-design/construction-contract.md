# Notification Jobs Construction Contract

## Scheduling and Lease

Recipient selection resolves active linked parents or administrator-selected primary recipient. Due times are computed in `Europe/Budapest`; idempotency key is `(assignment version, recipient, reminder type)`. A worker atomically leases a queued job; expired leases return to queue.

## Failure Contract

Transient provider failures retry at 5, 30, and 120 minutes. Permanent failures and exhausted retries become dead-letter; only super/kindergarten admins see redacted status. Provider payload carries recipient reference/template variables only; raw provider response and message body never enter audit logs.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
