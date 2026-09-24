# Business Logic Model

## Scoped Administration

Every admin route resolves organization/group scope before loading records or actions. Super admins manage organization settings/roles; kindergarten admins operate organization records; group admins are locked to assigned groups. Mutations use domain authorization, validation, and redacted audit events.

## Operations

Records, tasks/events, assignments, approvals, import, privacy lifecycle, archive, and reminder monitoring expose loading, empty, validation, success, error, and denied states.
