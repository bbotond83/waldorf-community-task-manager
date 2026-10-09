# Teacher Tracking Scalability Requirements

## Requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| NFR2.24 | Preserve the single-app, process-local source/injection boundary and bounded single-group/date reads; introduce no new service, distributed store or infrastructure scaling system. | Architectural/import inspection and query boundary tests. No estimated production load presented as measured. |
| NFR1.27 | Isolate request authority and test fixture mutation; one actor/request cannot reuse another actor's projection or grants. | Interleave authorized, unauthorized and changed-source reads using isolated fixtures and confirm scope/data independence. |

## Capacity and Growth

Production concurrency, record growth, cost and throughput baselines are unavailable. Synthetic fixtures establish functional behavior only. No capacity forecast or autoscaling trigger is promised for this role change. A linked production adapter must separately demonstrate indexed/bounded access, target capacity and operation under concurrent users before claiming production readiness.

## Sources

[functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), [requirements.md](../../../inception/requirements-analysis/requirements.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md), [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

