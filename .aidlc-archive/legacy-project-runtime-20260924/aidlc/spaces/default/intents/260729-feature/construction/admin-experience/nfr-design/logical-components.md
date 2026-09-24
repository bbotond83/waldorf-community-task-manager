# Logical Components

## Components

- **Admin shell and route guard** render only policy-eligible navigation and deny unauthorized deep links.
- **Scoped list services** provide paginated family, task, import, and audit projections.
- **Administrative command services** route authorized changes to the owning access, directory, coordination, import, or privacy domain.
- **Policy-aware form layer** validates input and displays generic failure states without leaking hidden data.

## Operational Interfaces

The administration telemetry boundary records route latency, authorization denials, and redacted command outcomes. Long-running job status is presented through durable status projections, allowing administrators to safely refresh or resume their workflow.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
