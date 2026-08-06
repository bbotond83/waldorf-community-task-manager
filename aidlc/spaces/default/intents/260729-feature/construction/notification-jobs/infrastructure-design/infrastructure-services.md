# Infrastructure Services

## Durable Queue

EU Supabase Postgres provides the job table, indexed due-job claims, leases, idempotency keys, retry state, and dead-letter records. Authenticated scheduler calls invoke bounded workers; the EU-compliant email adapter is isolated behind a server-only interface and receives recipient references until send time.

## Failure Boundaries

Queue state is transactional with producer changes, while provider delivery is retried using the durable 5/30/120-minute policy. Provider payloads, raw email values, and message content never persist in job logs or audit records.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
