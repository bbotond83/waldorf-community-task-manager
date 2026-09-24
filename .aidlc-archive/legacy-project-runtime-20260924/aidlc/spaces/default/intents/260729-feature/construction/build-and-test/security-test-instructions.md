# Security Test Instructions

## Automated Checks

Run the authorization matrix through domain services and direct Supabase calls for every role, resource, action, scope, and restricted field. Verify immediate revocation, generic denials, hostile import rejection, consent gating, redacted logs/audit, actor-bound swap confirmation, and final lifecycle eligibility checks.

## Infrastructure Checks

Apply the RLS migration to a disposable project and prove parents/read-only staff cannot insert, update, or delete domain rows; only scoped admins may mutate through permitted paths. Add dependency and secret scanning in CI, and block production until EU-region, controller, DPA, and provider configuration evidence is approved.

Sources: `../access-foundation/code-generation/code-summary.md`; `../import-migration/code-generation/code-generation-plan.md`; `../privacy-audit/code-generation/code-summary.md`.
