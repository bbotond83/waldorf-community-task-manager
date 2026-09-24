# Services

## Application Services

- Next.js server route layer orchestrates authenticated requests.
- Supabase Auth/Postgres provides identity and transactional storage; RLS is defense in depth.
- Domain services enforce role/resource policy, assignment transactions, import, and privacy rules.
- Job service persists idempotent reminder, retry, lifecycle, and recovery jobs; scheduled worker dispatches them.

## Scaling

The modular monolith scales stateless web handlers independently from workers; job and import operations are resumable and auditable.

## External Contracts

- Email adapter accepts templated Hungarian messages, idempotency key, and recipient reference; it never receives audit-sensitive free text.
- Scheduler invokes authenticated worker endpoints; jobs use exponential retry, bounded attempts, dead-letter status, and privacy-safe administrator visibility.
- EU processing configuration, provider DPA verification, and controller approval are production-release checks.
- Recovery service records import rollback/recovery status and exports redacted observability events.
