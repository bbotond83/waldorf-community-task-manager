# Admin Experience Construction Contract

## Surfaces and APIs

Records uses directory CRUD/archive; Tasks/Events and Approvals use coordination commands; Import uses preview/resolve/commit/recover; Privacy uses review/hold/release; Roles uses grant/revoke. Each surface displays active scope, supports loading/empty/validation/success/error/denied, and uses server-authorized API contracts.

## Scope and Forms

Group-admin group selectors are immutable to assigned scope. Forms reject invalid fields inline in Hungarian, use optimistic version conflict messaging, and emit redacted audit IDs on privileged mutations. Super-admin-only controls are absent for lower roles.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
