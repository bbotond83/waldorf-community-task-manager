# Teacher Tracking Observability Requirements

## Requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NFR1.28 | Retain existing audit/result correlation for authorization and integration failures without logging projected names, source records, credentials or raw query strings. | Inspect shared audit behavior and diagnostics; sentinel sensitive fields absent from emitted telemetry. Existing controlled audit actor/scope identifiers remain where the shared contract requires them. |
| NFR2.26 | Verification reports distinguish synthetic/static checks, actual local DB execution and real target RLS/integration checks. Preserve current tested SHA and unsigned private CI evidence policy. | Evidence manifest labels actual execution; missing linked target remains outstanding, never passed by static source tests. |

## Monitoring and Operations

No new metrics dashboard, distributed tracing provider, alert threshold or telemetry retention period is added. Existing diagnostics and CI reports provide the local evidence surface. Outcome counts/timings may be measured during verification with safe metadata; they are not production availability SLIs. Operation alerts and retention for a linked target remain separate approved work.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

