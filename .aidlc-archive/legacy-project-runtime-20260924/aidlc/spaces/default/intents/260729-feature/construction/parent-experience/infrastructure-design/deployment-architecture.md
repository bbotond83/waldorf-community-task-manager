# Deployment Architecture

## Parent Runtime

Parent routes run on Vercel and retrieve only family-scoped projections from EU-region Supabase through authenticated server handlers and RLS. Development and production are isolated; clients never receive privileged data credentials or another family identifier as authority.

## Release Controls

CI deploys immutable artifacts to development. Manual production approval follows mobile dashboard, assignment, cancellation, swap, scope-isolation, and redaction checks; rollback restores the prior application artifact without altering domain records.

Sources: `../nfr-design/performance-design.md`; `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
