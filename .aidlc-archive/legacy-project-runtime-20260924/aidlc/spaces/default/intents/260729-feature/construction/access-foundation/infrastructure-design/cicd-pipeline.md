# CI/CD Pipeline

## Pipeline and Promotion

Each change runs formatting, type checks, unit and integration tests, and security/dependency checks before merge. The merged build deploys automatically to the development environment, where a concise authentication, authorization-revocation, and RLS verification checklist runs. Production deployment is a separate manual approval using the immutable build artifact; failure rolls back to the previous Vercel deployment and retains the database migration status for remediation.

## Secrets and Release Controls

Vercel stores application runtime secrets and Supabase stores database/authentication secrets; neither appears in source, build logs, or client bundles. Production uses an EU-region Supabase project and approved EU-compliant provider configuration. The release checklist confirms data region, controller/DPA readiness, migration compatibility, and redacted audit logging before approval.

Sources: `../nfr-design/security-design.md`; `../nfr-design/logical-components.md`; `../functional-design/business-logic-model.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/services.md`.
