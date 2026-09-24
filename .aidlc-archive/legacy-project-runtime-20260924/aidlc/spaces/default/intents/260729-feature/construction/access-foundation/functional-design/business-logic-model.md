# Business Logic Model

## Authorization Flow

Every protected UI/API request resolves the authenticated subject, active role grants, scope, requested action, and resource. The policy decision runs before data retrieval. A revocation invalidates the matching grant; the next protected request re-evaluates grants and is denied without waiting for token expiry.

## Audit Flow

Privileged role/scope changes and denials emit redacted, access-controlled audit events. No protected field, resource-existence detail, phone, or email value appears in denial/audit copy.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
