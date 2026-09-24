# CI/CD Pipeline

## Validation

CI runs type, route authorization, RLS, accessibility, and redacted-audit tests. Development verification covers scoped lists, role changes, imports, audit access, and denied deep links before manual production release.

## Recovery

Vercel supports artifact rollback. Secrets remain in managed Vercel/Supabase stores; EU-region, controller, provider, and DPA checks remain production gates.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
