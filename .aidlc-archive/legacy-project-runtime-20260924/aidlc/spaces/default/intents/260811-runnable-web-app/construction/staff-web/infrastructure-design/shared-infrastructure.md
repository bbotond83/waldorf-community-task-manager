# Staff Web Shared Infrastructure

## Sources

Derived from [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md) and [services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Dependencies

Consumes the shared AppShell, role-aware navigation, session/config/result/focus primitives, staff application façade and authorized view-model contracts, existing domain public contracts, and versioned fixture/scenario/evidence identifiers. It owns only staff schedule presentation and route orchestration.

## External Infrastructure

None is provisioned. Local execution requires no production data, credential, Supabase, provider, or Vercel dependency. Runtime selection is explicit and mutually exclusive, and this intent performs no deployment.
