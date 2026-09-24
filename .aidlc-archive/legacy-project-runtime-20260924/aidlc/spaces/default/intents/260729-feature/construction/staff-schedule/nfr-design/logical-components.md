# Logical Components

## Components

- **Schedule route** validates the selected date range and presents accessible loading, empty, and error states.
- **Schedule projection service** builds role- and scope-filtered day and week views.
- **Read-only schedule adapter** serves staff projections without exposing any assignment mutation route.
- **Authorization adapter** supplies actor role and group scope to API and database policies.

## Operational Interfaces

The telemetry boundary records projection latency and authorization denials without task notes or contact values. A compact view model lets desktop and mobile layouts share the same policy-enforced data contract.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
