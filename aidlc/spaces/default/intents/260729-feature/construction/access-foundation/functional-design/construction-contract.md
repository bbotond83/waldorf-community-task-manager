# Access Foundation Construction Contract

## Decision Matrix

Super admins act organization-wide; kindergarten admins act organization-wide except super-admin governance; group admins act only within granted groups; parents act only on linked family/own requests; read-only staff read scoped schedules and required coordination names only. Server policy evaluates `(actor, role grant, scope, action, resource, field)` and RLS repeats the row-scope predicate.

## State and Errors

RoleGrant is `active` or `revoked`. A revocation increments the subject authorization version; every protected request compares it before loading data. `AuthorizationDenied` returns `Nincs jogosultság` / generic 403 without existence detail; mutations emit redacted audit events.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
