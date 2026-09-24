# Construction NFR Baseline and Observability

## Shared SLOs

- Launch capacity: 30 families. Protected reads p95 ≤500 ms; mutations p95 ≤1 s; user-visible core flows ≤2 s; monthly availability ≥99.5%.
- Emit structured, redacted telemetry for latency, authorization denials, mutation conflicts, queue delay, worker failures, import state, lifecycle actions, and audit retention.
- Alert on SLO breach, queue delay >60 seconds, dead-letter entry, import recovery >1 hour, failed lifecycle action, overdue annual review, or audit-expiry failure.

## Unit Acceptance

| Unit | Capacity / SLI | Reliability and alert |
|---|---|---|
| access-foundation | p95 authorization ≤100 ms at 30 families | authorization deny/error rate, RLS/policy mismatch, revocation propagation |
| family-directory | p95 reads ≤500 ms; paginated listings | link mutation failure, archive/restore rollback, scope-query latency |
| coordination-core | p95 mutations ≤1 s; concurrent conflicts measured | post-commit reminder event failure, conflict-rate threshold |
| notification-jobs | dispatch delay ≤60 s; 30-family queue | queue depth/delay, lease expiry, provider failure, DLQ count |
| staff-schedule | p95 projection ≤500 ms | API/UI error and latency telemetry; WCAG/browser/mobile checks |
| import-migration | preview/commit progress visible; recovery ≤1 hour | invalid/hostile input, mapping conflict, rollback result, recovery breach |
| parent-experience | p95 API ≤500 ms; UI ≤2 s | client/API errors, accessibility/browser/mobile checks |
| privacy-audit | bounded lifecycle/audit batches | overdue review, deletion failure, hold, retention-expiry alerts |
| admin-experience | p95 listing/API ≤500 ms; UI ≤2 s | dashboard/job-status errors, scope denial, accessibility/browser/mobile checks |

## Recovery and Quality

Transactional units validate rollback with automated failure drills. UI units pass the approved WCAG 2.2 AA core-flow scope on current Chrome, Safari, Firefox, mobile Safari, and mobile Chrome.

Sources: `../../inception/requirements-analysis/requirements.md`; `../access-foundation/functional-design/business-logic-model.md`; `../family-directory/functional-design/business-logic-model.md`; `../coordination-core/functional-design/business-logic-model.md`; `../notification-jobs/functional-design/business-logic-model.md`; `../import-migration/functional-design/business-logic-model.md`; `../privacy-audit/functional-design/business-logic-model.md`.
