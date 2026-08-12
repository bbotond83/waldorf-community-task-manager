# Parent Web Logical Components

## Sources

Derived from [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [logic](../functional-design/business-logic-model.md).

## Components

Invitation/auth route group; duties list/detail/actions; request detail/outcomes; notifications/read actions; contribution notes; shared parent state/focus primitives. Each depends on session/parent façades and runtime shell only. Failure is contained to route or initiating operation; no protected client cache/shared mutable store.

## Isolation

Parent components cannot import admin/staff routes, repositories, adapters, or raw domain aggregates. Synthetic provider/session behavior enters only through façade models.

