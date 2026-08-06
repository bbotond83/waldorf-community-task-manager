# Notification Jobs Code Generation Plan

- [x] Define durable job, in-app notification, email-attempt, provider, and privacy-safe status contracts. *(US-04; FR-14, FR-17)*
- [x] Implement 7-day/24-hour scheduling, immediate missed-threshold delivery, and revision-scoped deduplication. *(FR-13, FR-17)*
- [x] Create one in-app notification and one email attempt per recipient/threshold, with provider-idempotent or declared at-least-once status. *(FR-17)*
- [x] Record retry-scheduled outcomes without contact data and add DST/threshold/idempotency tests. *(NFR-01, NFR-03, NFR-05)*
