# Domain Entities

## Entities

- **User**: authenticated subject identifier and active status.
- **RoleGrant**: user, role, scope reference, granted/revoked timestamps.
- **Scope**: organization or group boundary.
- **AuthorizationDecision**: action, resource reference, allow/deny result, reason code.
- **RedactedAuditEvent**: actor, event type, timestamp, related entity ID, redacted summary.

## Relationships

A User has many RoleGrants; each grant references one Scope. AuthorizationDecision evaluates active grants for one action/resource. Role changes create RedactedAuditEvents.
