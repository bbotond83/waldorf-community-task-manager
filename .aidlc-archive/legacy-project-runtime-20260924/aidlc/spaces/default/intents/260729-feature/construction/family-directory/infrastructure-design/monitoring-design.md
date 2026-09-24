# Monitoring Design

## Signals

Record protected-read and mutation p95, RLS denials, policy/RLS mismatches, database errors, migration state, and directory command failures. Logs use structured redacted identifiers and never include email, phone, optional profile text, or child/family names. Availability and latency use the shared 99.5% / 500 ms / one-second MVP thresholds.

## Alerting and Response

Developer-owned alerts trigger for sustained authorization failures, elevated database errors, failed migrations, backup/recovery failures, and SLO breaches. Dashboards expose aggregate scope-safe counts; an incident runbook first protects access, then checks RLS/policy/migration state before restoring service.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
