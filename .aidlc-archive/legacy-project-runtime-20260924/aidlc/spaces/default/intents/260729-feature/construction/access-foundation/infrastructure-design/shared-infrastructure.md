# Shared Infrastructure

## Shared Platform Boundaries

The Next.js application runs on Vercel, while the production Supabase Auth and Postgres project is provisioned in an EU region. The modular monolith's route layer, access controls, domain services, audit writer, and worker endpoints share the authenticated database boundary but own separate schemas/policies and typed service contracts. Development and production use separate projects and separate environment secrets.

## Operations and Ownership

Supabase RLS is the final data-access boundary; server-side Vercel handlers hold privileged credentials and never expose them to browsers. Vercel deployment events, Supabase authentication/database signals, authorization telemetry, and job failures feed developer-owned alerts. The platform keeps redacted logs and applies the one-year audit retention design; production provider and controller/DPA checks remain release prerequisites.

Sources: `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
