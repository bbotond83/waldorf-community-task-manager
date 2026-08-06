# CI/CD Pipeline

## Validation Stages

CI runs type, component, accessibility, mobile-performance, route-authorization, and RLS tests. Development verification tests family isolation, eligible action rules, denied cross-family access, generic errors, and redacted telemetry before manual production promotion.

## Release Recovery

Vercel artifact rollback is available for UI regressions. Managed Vercel/Supabase secret stores protect runtime values; production EU-region and provider compliance are release prerequisites.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
