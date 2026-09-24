# Security Design

## Authorization

Route handlers authorize actor, scope, family ownership, and request state before transition. Event-note reads require participant/admin eligibility; reasons and contributions are redacted in audit/log surfaces.

Sources: `../nfr-requirements/security-requirements.md`; `../functional-design/business-logic-model.md`.
