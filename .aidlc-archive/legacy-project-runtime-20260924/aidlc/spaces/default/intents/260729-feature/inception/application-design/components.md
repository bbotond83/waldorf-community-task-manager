# Components

## Domain Modules

- Identity & Access: roles, scopes, invitations, immediate revocation.
- Family Directory: families, parents, children, groups, school years, restricted fields.
- Coordination: tasks, events, assignments, signup, swap, cancellation, reminders.
- Import: upload validation, mapping preview, conflict resolution, atomic commit/recovery.
- Privacy & Audit: lifecycle review/deletion/anonymization and redacted evidence.
- UI: role-aware Next.js routes and accessible parent/admin/staff views.

## Boundaries

Route handlers call domain modules; modules own policy and persistence contracts; UI never bypasses authorization. Sources: `../requirements-analysis/requirements.md`, `../user-stories/stories.md`, `../practices-discovery/team-practices.md`.

## Data Ownership

Identity owns User, RoleGrant, Scope, Invitation; Family owns Family, Parent, Child, Group, SchoolYear; Coordination owns Task, Event, Assignment, SwapRequest, CancellationRequest, Contribution; Import owns ImportRun, Preview, Mapping, Conflict; Privacy owns RetentionHold and LifecycleRun; Audit owns RedactedAuditEvent; Jobs owns Job, DeliveryAttempt, and idempotency key. Foreign references are IDs only; no module writes another module’s owned records directly.
