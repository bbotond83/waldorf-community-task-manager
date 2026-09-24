# Monitoring Design

## Signals

Track queued imports, parser duration, batch size, preview latency, commit duration, lifecycle state, storage expiry, and recovery success. Structured events keep import IDs, counts, and safe failure categories only; raw rows, contacts, and source files are excluded.

## Alerting and Response

Developer alerts fire for sustained import failures, stuck runs, failed rollback/recovery, staging-storage errors, and SLO breaches. The runbook checks run state, worker health, storage expiry, and transactional commit status before retry or re-import.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
