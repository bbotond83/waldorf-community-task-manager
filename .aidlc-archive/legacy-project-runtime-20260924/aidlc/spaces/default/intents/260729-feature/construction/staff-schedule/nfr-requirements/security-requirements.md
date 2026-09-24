# Security Requirements

## Controls

Read-only staff receive only scope-authorized schedule projection fields. Contacts, family IDs, assignments, sensitive data, and all mutation routes are denied server-side.

## Verification

UI and direct API tests assert denied fields are absent, not merely hidden.

Sources: `../../functional-design/business-logic-model.md`; `../../../inception/requirements-analysis/requirements.md`.
