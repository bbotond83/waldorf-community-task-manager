# Monitoring Design

## Signals

Track queue age, scheduler success, lease expiry, worker duration, provider outcome class, retry count, and dead-letter count. Logs are structured and redacted, retaining job IDs and safe outcome codes only; dispatch delay targets 60 seconds at normal load.

## Alerting and Response

Developer alerts trigger for queue-age breaches, repeated scheduler failure, provider outage, abnormal dead letters, and worker authentication failures. The runbook checks queue claims and provider health, then safely replays eligible dead-letter work through authorized tooling.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
