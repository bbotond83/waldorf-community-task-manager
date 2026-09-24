# Security Requirements

## Controls

Reject hostile/unsupported files; store preview and conflict data under admin-only scope; redact personal data in results/audit; bind commit to immutable hash/version.

## Verification

Test malformed files, unauthorized preview/commit, identity conflicts, and audit redaction.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
