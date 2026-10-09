# Teacher Tracking Monitoring Design

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
| --- | --- | --- | --- |
| Production source coverage | Existing combined coverage report | At least 80% line, branch, function | NFR2.23 |
| Critical browser accessibility | Existing Axe reports plus keyboard checks | Zero serious/critical automated findings | NFR3.23 |
| Type/lint/test/build/start outcomes | Existing local/CI reports | All required checks green | NFR2.23/27 |
| Dependency/SAST and secret findings | Existing CI/security reports | Block high/critical security findings and detected secrets | NFR2.23 |
| Local timing observations | Existing configured browser/profile timing checks | Existing executable thresholds, captured at verification | NFR2.21; no new latency SLA |

## Alerts

| Alert | Condition | Severity | Routes to |
| --- | --- | --- | --- |
| Existing CI check failure | Required gate fails | Blocking delivery | Existing repository check reporting and developer |
| New production alert | Not configured in this change | Not applicable | Linked target operational design remains separate |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
| --- | --- | --- |
| Production availability/throughput | Not established for unlinked target | No production window measured |
| Local test/timing result | Existing executable acceptance only | Per recorded run; not an availability SLO |

## Logs & Tracing

| Surface | Design | Constraint |
| --- | --- | --- |
| Existing authorization audit | Shared safe actor/scope/action/outcome identifiers | NFR1.28; no raw source/display/private data or cookie |
| Application failure | Existing result/presentation classification and safe correlation | No stack/raw source/query disclosure |
| Tracing/dashboard provider | No new provider or dashboard | No new sampling/retention/alert policy |
| Evidence archive | Existing private CI evidence, unsigned, 14 days | NFR2.26; actual tested SHA and execution category |

Sensitive sentinel checks verify emitted diagnostics remain clean. Static SQL, synthetic reads and actual local/real DB results are separate categories; missing target is outstanding.

## Sources

[performance-design.md](../nfr-design/performance-design.md), [security-design.md](../nfr-design/security-design.md), [scalability-design.md](../nfr-design/scalability-design.md), [reliability-design.md](../nfr-design/reliability-design.md), [observability-design.md](../nfr-design/observability-design.md), [logical-components.md](../nfr-design/logical-components.md), [components.md](../../../inception/domain-design/components.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

