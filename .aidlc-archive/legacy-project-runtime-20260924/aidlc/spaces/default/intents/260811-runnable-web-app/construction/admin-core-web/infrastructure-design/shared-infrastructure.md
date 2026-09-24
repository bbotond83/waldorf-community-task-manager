# Admin Core Shared Infrastructure

## Sources

Derived from [performance design](../../nfr-design/performance-design.md), [security design](../../nfr-design/security-design.md), [logical components](../../nfr-design/logical-components.md), Application Design [components](../../../../inception/application-design/components.md)/[services](../../../../inception/application-design/services.md), and [business logic](../../functional-design/business-logic-model.md).

## Consumed Shared Contracts

Runtime AppShell/config/session primitives; application façade/result/auth/view-model ports; existing domain module public APIs; design tokens/forms/states; scenario/evidence manifest.

## Provided Contracts

Administrator shell, scope/filter/detail/action layout components may be reused by `admin-advanced-web`. They contain presentation behavior only and cannot expose core private route state or domain adapters.

## External Infrastructure

None. Supabase/provider/Vercel checks remain OUTSTANDING. This unit performs no deployment.
