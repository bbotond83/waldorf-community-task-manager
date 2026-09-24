# CI/CD Pipeline

## Validation Stages

CI runs type, component, route-authorization, RLS, accessibility, and mobile-performance tests. Development verification confirms group-scoped read-only schedules, denied direct mutation attempts, hidden contact fields, and 500 ms protected-read p95 before manual production approval.

## Release Recovery

Vercel promotes immutable artifacts and can roll back the UI. Vercel and Supabase secret stores contain runtime values; none are exposed to clients or CI logs. Production region and provider compliance remain release checks.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
