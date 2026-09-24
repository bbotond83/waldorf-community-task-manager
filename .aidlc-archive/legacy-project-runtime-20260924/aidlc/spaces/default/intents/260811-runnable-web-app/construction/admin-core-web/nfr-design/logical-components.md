# Admin Core Web Logical Components

## Sources

Derived from [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Components and Failure Domains

| Component | Boundary | Failure domain |
|---|---|---|
| admin route layouts | authorized scope/nav/context | current route |
| dashboard panels | bounded independent summaries | one panel |
| collection/filter/pagination | one authorized resource family | list only |
| detail/form/action | one aggregate/version/idempotency | one operation |
| approval outcome | exact request decision state | one request |
| shared state/error/focus primitives | presentation only | render region |

## Isolation

UI imports façade contracts and runtime primitives only. Admin advanced routes may reuse shell/component patterns but admin core never depends on advanced workflows. Domain/adapters remain behind façades. No shared mutable client store contains protected records.
