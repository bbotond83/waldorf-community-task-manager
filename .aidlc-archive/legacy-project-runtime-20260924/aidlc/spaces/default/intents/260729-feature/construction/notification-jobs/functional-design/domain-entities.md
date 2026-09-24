# Domain Entities

## Entities

- ReminderJob, DeliveryAttempt, RecipientSelection, DeadLetterRecord.

## Lifecycle

Job states: queued, claimed, delivered, retrying, cancelled, dead-letter. DeliveryAttempt references job, timestamp, redacted outcome, and retry count.
