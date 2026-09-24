# Coordination Core Construction Contract

## State Machines

Assignment: `available → active → swap_pending|cancellation_pending → active|removed`. Qualified swap requires two active eligible family assignments, both confirmations, capacity validity, and matching versions; otherwise it is admin-pending. Cancellation approval removes/releases; rejection returns active.

## Transactions

Signup, swap, cancellation, assignment, event-note edits use optimistic versions. Conflicts/capacity/ineligible scope roll back every changed row. Assignment mutation publishes `assignment.changed`; job scheduling replaces stale reminders. Primary recipient defaults to all active linked parents and may be restricted by an authorized admin.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
