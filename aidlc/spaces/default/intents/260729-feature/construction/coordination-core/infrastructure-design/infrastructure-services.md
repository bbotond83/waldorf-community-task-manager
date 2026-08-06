# Infrastructure Services

## Durable Coordination Store

EU Supabase Postgres holds tasks, events, assignments, signup and review requests, with foreign keys, unique constraints, and transaction isolation protecting capacity and eligibility rules. Indexes cover group, school year, event time, assignment status, and request state. The shared durable job service receives only committed event changes for reminders.

## Service Boundaries

Server-side coordination services call the shared policy, directory, audit, and notification interfaces through typed contracts. RLS provides data-access defense in depth, while assignment transitions and audit writes occur atomically; no distributed transaction with the email provider is required.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
