# Reliability Requirements

## Recovery

Lease expiry returns abandoned jobs to queue. Transient failures retry after 5, 30, and 120 minutes; exhausted jobs are dead-lettered and auditable.

## Verification

Simulate worker crash, duplicate dispatch, provider outage, and stale reminder cancellation.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
