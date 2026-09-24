# Logical Components

## Components

- **Parent dashboard route** presents the family-scoped task and request summary with accessible mobile states.
- **Family projection service** composes assignments, children, and eligible actions under server-enforced scope.
- **Request command client** submits cancellation and swap intents to the coordination domain and renders privacy-safe outcomes.
- **Session boundary** provides authenticated identity without exposing authorization decisions to client state.

## Operational Interfaces

The UX telemetry boundary records anonymous page-performance and redacted command results. The route contract uses explicit loading, empty, success, and error states so the interface remains usable during slow or failed secondary fetches.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
