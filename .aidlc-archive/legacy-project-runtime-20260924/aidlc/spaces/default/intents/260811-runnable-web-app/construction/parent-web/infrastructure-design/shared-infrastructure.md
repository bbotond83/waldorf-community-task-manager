# Parent Web Shared Infrastructure

## Sources

Derived from [performance](../../nfr-design/performance-design.md), [security](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md)/[services](../../../../inception/application-design/services.md), and [logic](../../functional-design/business-logic-model.md).

## Dependencies

Consumes runtime AppShell/session/config/state primitives; application parent/session/auth/view-model ports; existing domain public contracts; fixture/scenario/evidence IDs. Owns only parent/invitation presentation components and route actions.

## External Infrastructure

None provisioned. No production data, credential, provider, Supabase, or Vercel dependency is required locally; no deployment occurs.
