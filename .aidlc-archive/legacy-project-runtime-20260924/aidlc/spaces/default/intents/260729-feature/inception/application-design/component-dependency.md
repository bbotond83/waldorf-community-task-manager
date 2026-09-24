# Component Dependency

## Dependency Flow

`UI → Route handlers → Access policy → Domain module → Supabase Postgres/RLS`.

Coordination depends on Access and Family Directory; Import depends on Family Directory, Coordination, and Audit; Privacy depends on Family Directory, Coordination, and Audit; Job service consumes domain events and writes privacy-safe status.

## Communication

User operations are synchronous transactional calls. Reminder, lifecycle, retry, and recovery processing is asynchronous through durable job records with idempotency keys.

## Transaction and Event Matrix

| Trigger | Transaction | Durable follow-up | Shared resource |
|---|---|---|---|
| Assignment/swap decision | assignment state + audit | replace reminders | Job, Audit |
| Import commit/rollback | canonical records + import run | recovery/status | ImportRun, Audit |
| Lifecycle hold/deletion | retention state + anonymization | audit retention job | Audit, Job |
| Role revocation | role grant + audit | invalidate access | Identity, Audit |
