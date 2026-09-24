# Application Design Questions

## Q1 — Application Style

Which application boundary should the MVP use?

- A. Next.js modular monolith with server-side route handlers and domain modules. *(Recommended)*
- B. Separate microservices from the first release.
- C. Client-only application with direct database access.
- X. Other (please specify)

[Answer]: A — Next.js modular monolith with server-side route handlers and domain modules.

## Q2 — Data and Authorization

Which data-access pattern should enforce role and resource rules?

- A. Supabase Postgres with row-level security plus server-side domain authorization. *(Recommended)*
- B. Application checks only.
- C. Database checks only.
- X. Other (please specify)

[Answer]: A — Supabase Postgres with row-level security plus server-side domain authorization.

## Q3 — Background Work

Which pattern should handle reminders, lifecycle jobs, and import recovery?

- A. Durable database-backed jobs invoked by scheduled workers with idempotency keys. *(Recommended)*
- B. Browser timers.
- C. Synchronous requests only.
- X. Other (please specify)

[Answer]: A — Durable database-backed jobs invoked by scheduled workers with idempotency keys.
