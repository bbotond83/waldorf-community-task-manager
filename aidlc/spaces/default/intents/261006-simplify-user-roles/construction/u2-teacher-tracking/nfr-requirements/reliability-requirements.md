# Teacher Tracking Reliability Requirements

## Requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NFR1.29 | Fail closed on invalidated session, denied scope, malformed/mismatched source and infrastructure failure; return no stale/partial protected data. | Inject each failure after a prior success and verify current result and markup expose no previous rows/names/counts. |
| NFR2.25 | Normalize successful zero rows to authorized empty; absent detail remains generic denial. Preserve user retry for retryable failure and later guidance for terminal failure. | Deterministic state matrix using existing application result/presentation mapping; fresh authority/source on retry, no automatic retry or fabricated successful fallback. |
| NFR1.30 | Tracking preserves existing group/task/assignment identities and relationships; no tracking write or status lifecycle is introduced. | Before/after fixture snapshots around reads, failure and denied writes. Modify backing source only through isolated operator/test seam to prove refetch. |

## Availability and Recovery

No new SLA/SLO, RTO/RPO or network timeout is established. Existing synchronous in-process boundary and classification remain; future remote deadlines require separate design. U2 has no durable store to back up; data owners retain recovery responsibility. Production integration and operational recovery evidence remain unavailable until a target is linked and exercised.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

