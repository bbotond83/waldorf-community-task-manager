# Security Requirements

## Controls

- Enforce server authorization and Supabase RLS for every protected operation.
- Re-evaluate role/scope on every protected request; revocation denies the next request.
- Return generic denials; redact audit evidence; prevent sensitive fields in logs, notifications, fixtures, and screenshots.

## Verification

Role/resource/field matrix tests cover allowed, denied, revocation, and direct API paths.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
