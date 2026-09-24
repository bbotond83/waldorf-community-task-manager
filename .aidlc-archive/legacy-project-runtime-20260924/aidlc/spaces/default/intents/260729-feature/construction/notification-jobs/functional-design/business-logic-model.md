# Business Logic Model

## Reminder Scheduling

Assignment creation/change schedules idempotent 7-day and 24-hour jobs in `Europe/Budapest`. Changes cancel stale jobs, recalculate recipients, and suppress duplicate active jobs.

## Delivery Recovery

Worker claims one durable job, delivers through the email adapter, records privacy-safe outcome, and retries transient failure with exponential backoff and bounded attempts. Exhausted jobs enter dead-letter state for authorized administrators.
