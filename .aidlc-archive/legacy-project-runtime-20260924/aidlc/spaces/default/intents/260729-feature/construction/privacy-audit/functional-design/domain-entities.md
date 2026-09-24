# Domain Entities

## Entities

- LifecycleRun, RetentionHold, DataCategoryPolicy, DeletionAction, AnonymizationAction, RedactedAuditEvent.

## Relationships

LifecycleRun references Family and applicable policies; RetentionHold targets records/categories; actions create RedactedAuditEvents with retention expiry.
