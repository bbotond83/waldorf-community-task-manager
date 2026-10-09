# Teacher Tracking Performance Requirements

## Requirements

| ID | Requirement | Measurement and acceptance |
| --- | --- | --- |
| NFR2.21 | Preserve established runnable-app performance checks without adding a new numeric latency target. | Execute existing relevant browser/profile timing and build/start checks at final verification; capture exact configured thresholds and actual results from executable checks. No substitute historical counts. |
| NFR2.22 | Bound the date query to real dates with elapsed difference at most 31 days and one currently authorized group; avoid repeated source reads per entry. | Instrument fake read boundary for list/detail/refetch; verify one bounded request per workflow, no per-row fetch loop and no automatic retry loop. Record fixture size and process-local conditions. |
| NFR1.21 | Performance optimization must preserve fresh grant/version and current source reads. | Revoke a grant and change source data between requests; subsequent requests deny or expose new authorized values. No permanent projection/status cache. |

## Benchmark Scope and Evidence

Local synthetic fixtures are the benchmark workload; no production concurrency, throughput, network deadline or remote service capacity target is introduced. A future remote adapter needs separately approved capacity/deadline requirements. Existing configured performance failures remain blocking; baseline timing observations are not new SLAs.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

