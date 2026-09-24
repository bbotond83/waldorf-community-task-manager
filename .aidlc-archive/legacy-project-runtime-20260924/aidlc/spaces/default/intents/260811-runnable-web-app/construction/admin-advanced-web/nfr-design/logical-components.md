# Administrator Advanced Web Logical Components

## Sources

Derived from [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Components and Failure Domains

| Component | Boundary | Failure domain |
|---|---|---|
| `ImportRouteGroup` | staged preview, conflict, commit, recovery orchestration | one preview/run |
| `ReminderMonitorRoute` | bounded job query and classified retry | one job/action |
| `GovernanceRoute` | authorized grant projection/change and session invalidation | one grant/change |
| `LifecycleRoute` | eligible candidate/detail and atomic lifecycle command | one family/action |
| `AdvancedSettingsRoute` | authorized recipients and settings | one settings action |
| shared advanced state/form/focus primitives | presentation only | one render region |

## Isolation

Advanced routes import only admin façade contracts, authorized view models, and shared runtime/admin-shell primitives. Workbook stores, job coordinators, session invalidators, provider/database adapters, domain services, and audit sinks remain behind the façade/composition root. Admin core does not depend on advanced workflows, and no protected workflow state lives in a shared mutable client store.
