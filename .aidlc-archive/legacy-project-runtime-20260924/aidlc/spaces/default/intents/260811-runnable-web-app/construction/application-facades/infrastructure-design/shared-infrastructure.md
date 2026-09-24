# Application Facades Shared Infrastructure

## Sources

Derived from façade [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), plus [business logic](../../functional-design/business-logic-model.md).

## Shared Ports

- session, authorization, clock, ID, idempotency, event/job, evidence, and adapter-failure classification;
- domain public ports/barrels for Access, Directory, Coordination, Parent, Admin, Staff, Import, Notifications, Privacy;
- immutable result/view-model/validation/authorization/event/evidence contract packages.

## Adapter Ownership

`runtime-foundation` selects synthetic/production implementations. Existing domain modules own repository adapters. The façade unit defines ports and orchestration but no environment parsing, HTTP cookie, UI component, database schema, or provider client.

## Isolation

Every operation receives dependencies through construction. Tests use malicious/faulting fakes to prove fail-closed behavior. Evidence/event failure cannot authorize or roll back a successful owning-domain transaction; it surfaces a separate redacted operational outcome according to the workflow contract.

## External Infrastructure

None is provisioned. Future Supabase/provider implementations bind to ports and remain linked-target evidence. No deployment occurs.
