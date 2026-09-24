# Interaction Specification

## Workflow Patterns

- Simple actions use inline confirmation, field errors, and status announcements.
- Swaps, cancellations, approvals, and import conflict resolution use dedicated detail views with explicit submit/cancel controls.
- Import confirmation stays disabled until all blocking mapping and identity conflicts are resolved.

## State Rules

- Request outcomes are pending, approved, rejected, or invalidated; approved swaps update both assignments atomically.
- Permission-denied routes render `Nincs jogosultság` without protected data.
- Reminder status is privacy-safe and role-scoped.
- Role/scope removal denies the affected user on the next UI/API/data request; privileged changes retain redacted, access-controlled audit evidence.
- Privacy lifecycle shows annual review, last-child departure, sibling/hold deferral, 30-day grace period, deletion/anonymization, and redacted audit result.
- Interrupted imports offer safe recovery or rollback guidance and report verified restoration within the one-hour objective.

## Responsive Behavior

Use single-column cards on mobile; convert tables to equivalent accessible summaries; retain filters, actions, and state feedback without horizontal-only interactions.

Sources: `mockups.md`, `../user-stories/stories.md`, `../requirements-analysis/requirements.md`.
