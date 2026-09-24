# Shared Infrastructure

## Sources

Shared boundaries derive from [security design](../../nfr-design/security-design.md), Application Design [components](../../../../inception/application-design/components.md), and [services](../../../../inception/application-design/services.md).

## Shared Local Contracts

- Runtime configuration schema and fail-closed mode guard.
- Session/cookie boundary and authorization-version cache key.
- Application state/result and privacy-safe evidence envelope.
- Deterministic clock, ID/idempotency providers and fixture registry.
- AppShell design tokens, accessibility/status primitives, readiness marker.

## Ownership

`runtime-foundation` owns packaging/config/composition primitives. `application-facades` owns authorization and screen-model contracts. Domain modules own records/rules. UI units consume contracts without mutating shared infrastructure.

## External Sharing

No cloud account, database, bucket, queue, secrets manager, DNS, or target project is shared/provisioned by this intent. Future infrastructure must bind through documented ports rather than changing domain/UI ownership.
