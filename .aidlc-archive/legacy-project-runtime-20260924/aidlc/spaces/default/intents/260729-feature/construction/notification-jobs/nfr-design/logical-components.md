# Logical Components

## Components

- **Notification producer** creates and cancels idempotent reminder jobs from assignment events.
- **Job repository** owns indexed due-job queries, leases, transitions, and uniqueness checks.
- **Scheduler and worker** claim due work, resolve recipients, send through the email adapter, and persist redacted outcomes.
- **Email adapter** encapsulates the approved EU-compliant provider and normalizes transient versus permanent failures.

## Operational Interfaces

The queue telemetry component exports queue age, claim failures, retry count, and dead-letter count. The administrator delivery-status projection reads only redacted operational fields and routes authorized replay or cancellation actions through the job repository.

Sources: `../nfr-requirements/tech-stack-decisions.md`; `../nfr-requirements/reliability-requirements.md`; `../functional-design/business-logic-model.md`.
