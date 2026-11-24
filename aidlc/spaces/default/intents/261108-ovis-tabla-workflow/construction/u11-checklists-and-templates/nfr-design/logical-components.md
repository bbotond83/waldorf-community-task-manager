# Logical Components: u11-checklists-and-templates

Where the designs in this folder apply. Requirements come from the six files in `nfr-requirements/` of this Unit, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | Session, parent, manager, organiser and super-admin decisions used by every command | Commands are denied |
| Checklists | Templates, the copy, the event's checklist, claims, done marks, reads, the install, the internal functions and the removal pair | The page shows its error state; a command rolls back as a whole |
| Events (U10) | Event facts read through C13; `event_save_core` gains the helpers as notice recipients | The event save rolls back as before; checklist pages show their error state |
| Duties (today's tasks) | `task_save_core` refuses an event link | The task save is refused; other tasks are untouched |
| TimedChecks (U5) | Two registered daily checks | A failing event is recorded and the others still run |
| Notifications (U5) | Two notice kinds on U10's `event` target | A refusal rolls the caller back; a failed email is retried and listed |
| Audit | New action names | The change rolls back |
| WebApplication | Checklist block, template field on the event form, checklist editor, template screens, task form without the event select | The page shows its error state |
| Seed and reset | Calls the install and adds invented checklists to demo events | The local stack is not rebuilt; no effect on rules |

## Blast Radius

The migration adds seven tables and replaces two functions of other units (`task_save_core`, `event_save_core`). Both replacements keep their earlier behaviour and their existing tests must stay green. Each command runs in one transaction, so a defect rolls back instead of half-applying. A daily check isolates each event, so one bad event cannot stop the run.

## Shared Resources

One Postgres database, the audit log, U5's notice registries, email queue and run record, and U10's event row (read and locked `for share`, never written). The functions delivered for U10, U12 and U14 have their names and meanings fixed in this Unit, with the contract deltas listed in `functional-spec.md`.
