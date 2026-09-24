# Business Rules

## Rules

- Each reminder type, assignment version, and recipient has one idempotency key.
- Stale, cancelled, or reassigned duties may not deliver queued reminders.
- Status/audit data is redacted; contact values and message contents are never exposed.
