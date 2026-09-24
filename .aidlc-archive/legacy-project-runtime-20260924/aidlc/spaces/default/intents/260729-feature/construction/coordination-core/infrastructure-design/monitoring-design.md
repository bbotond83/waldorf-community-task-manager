# Monitoring Design

## Signals

Collect protected read/mutation latency, transaction retries, capacity conflicts, stale state transitions, authorization denials, and downstream job-enqueue failures. Structured logs retain IDs and redacted outcomes only; cancellation or swap reasons, contacts, and private notes never enter telemetry.

## Alerting and Response

Developer alerts fire for sustained error or conflict rates, failed database transactions, queue-enqueue failure, and shared SLO breaches. The incident runbook checks migration state, policy/RLS denials, transaction contention, and job outbox status before applying a replay or recovery procedure.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
