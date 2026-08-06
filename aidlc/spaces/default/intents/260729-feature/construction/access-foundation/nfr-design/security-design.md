# Security Design

## Enforcement Layers

Next.js middleware/session handling authenticates the subject; route handlers invoke domain authorization; Supabase RLS repeats scope predicates at data access. Every protected request compares the subject authorization version with active RoleGrants to enforce immediate revocation.

## Data Protection and Audit

Authorization failures return generic Hungarian denial. Redacted audit events contain actor, role, event type, timestamp, related ID, and safe summary only. Logging filters remove contacts, optional-profile values, and protected-resource existence details.

## Verification

Automated matrix tests exercise allowed/denied field access, direct API calls, revoked sessions, and RLS bypass resistance; telemetry measures p95 authorization ≤100 ms.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
