# Application Facades Logical Components

## Sources

Derived from [security requirements](../nfr-requirements/security-requirements.md), [technology decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Components

| Component | Responsibility | Failure domain |
|---|---|---|
| `InputValidator` | shared normalization/schema errors | request only; no domain call |
| `SessionGateway` | session resolution/freshness/switch/revocation signal | request/session; fail closed |
| `AuthorizationContract` | matrix lookup and scope/field decision | request; generic denial |
| role façades | workflow orchestration over public domain ports | one operation |
| `OutcomeMapper` | exhaustive typed result/error classification | one operation; terminal by default |
| `ScreenModelFactory` | allowlisted authorized projections | response only; reject forbidden keys |
| `IdempotencyStore` | duplicate/retry result coordination | mutation availability; never bypass auth |
| `EventCoordinator` | privacy-minimized follow-up events/jobs | follow-up only; domain result remains visible |
| `EvidenceRecorder` | synthetic/linked result metadata | evidence only; failure reported separately |

## Dependency Rules

Delivery imports public façade/types. Façades import domain barrels and application contracts. Infrastructure implements ports. No component imports Next.js, React, environment, cookies, database clients, or concrete synthetic/production adapters.

## Shared Resources

Shared immutable contracts are result/state codes, authorization/sensitive-field IDs, validation cases, event/evidence envelopes, and clock/ID/idempotency ports. No shared mutable aggregate or database schema is introduced.
