# Data Model

## Core Relationships

- User has scoped RoleGrants; Family has many Parents and Children; Children belong to Group and SchoolYear.
- Task/Event has many Assignments; Assignment belongs to Family and has reminder Jobs; Swap/Cancellation references an Assignment.
- ImportRun has Preview, Mapping, Conflict, and Result records; canonical imported records retain source references.
- LifecycleRun references Family, RetentionHold, and RedactedAuditEvent.

## Integrity

Foreign keys, scoped ownership, immutable import-preview hash/version, idempotency keys, and transactional assignment/import mutations enforce consistency.
