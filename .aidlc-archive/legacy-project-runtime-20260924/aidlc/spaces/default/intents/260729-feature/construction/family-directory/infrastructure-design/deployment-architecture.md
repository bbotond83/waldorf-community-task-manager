# Deployment Architecture

## Runtime Topology

Next.js routes deploy to Vercel with separate development and production environments. Server routes access the EU-region Supabase project through server-only credentials; browser clients use restricted public configuration and Supabase RLS. Family-directory commands remain in the modular monolith, with no direct browser access to privileged tables.

## Environment Controls

Production and development use distinct Supabase projects, schema migrations, and secrets. Immutable Vercel artifacts are manually promoted to production after CI and the development verification checklist; rollback returns the frontend to the prior artifact while preserving an explicit migration recovery decision.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/scalability-design.md`; `../nfr-design/reliability-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
