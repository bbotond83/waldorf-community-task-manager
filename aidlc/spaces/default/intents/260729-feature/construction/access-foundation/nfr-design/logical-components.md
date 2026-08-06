# Logical Components

## Components

- `SessionResolver`: validates authenticated subject and authorization version.
- `PolicyEngine`: evaluates role, scope, action, resource, and field.
- `RlsRepository`: applies database predicate defense in depth.
- `AuditWriter`: persists redacted privileged-event evidence.
- `AuthorizationTelemetry`: records latency, deny/error rate, and policy/RLS mismatch signals.

## Interactions

Route handlers call SessionResolver then PolicyEngine before RlsRepository. Allowed mutations call AuditWriter; deny or mismatch signals flow to AuthorizationTelemetry. Components use typed decisions and never return protected fields on denial.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
