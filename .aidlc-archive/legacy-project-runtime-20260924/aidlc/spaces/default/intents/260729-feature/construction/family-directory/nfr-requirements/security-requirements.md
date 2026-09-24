# Security Requirements

## Controls

- Enforce field-level policies for contact, locality, and optional profile data.
- Scope every relationship read/write through server authorization and RLS.

## Verification

Test linked-family, unrelated-parent, staff, group-admin, and revocation paths.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
