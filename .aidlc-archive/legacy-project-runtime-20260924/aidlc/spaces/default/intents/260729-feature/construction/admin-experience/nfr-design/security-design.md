# Security Design

## Administrative Scope

The admin shell derives navigation and data access from the authenticated role and kindergarten/group scope. Super Admin and Kindergarten Admin may use global authorized controls; Group Admin receives only explicitly permitted scoped controls. Normal parents and read-only staff cannot reach administration routes, even by direct URL.

## Sensitive Data Handling

Directory, audit, and import views use server-built projections that expose contact and optional profile fields only to roles approved by policy. Every administrative mutation rechecks authority at the command service and database layers, and logs a redacted audit event without sensitive free text or raw contact values.

Sources: `../nfr-requirements/security-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
