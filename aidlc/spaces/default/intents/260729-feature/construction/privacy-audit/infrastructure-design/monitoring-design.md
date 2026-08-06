# Monitoring Design

## Signals

Track retention backlog, candidate age, batch outcome, hold count, audit-write failures, and redaction validation failures. Logs contain IDs and safe categories only, never contact values, optional-profile text, or sensitive reasons.

## Alerting

Developer alerts fire for stuck lifecycle runs, failed audit writes, retention backlog, and unauthorized audit access anomalies. The runbook checks holds, batch state, and database health before a safe retry.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
