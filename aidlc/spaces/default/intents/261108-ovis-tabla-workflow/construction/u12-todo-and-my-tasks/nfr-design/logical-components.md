# Logical Components: u12-todo-and-my-tasks

Where the designs in this folder apply. Requirements come from `nfr-requirements/`, behaviour from `functional-spec.md` and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | Session, parent, family, group-admin and super-admin decisions used by every command | Commands are denied |
| Todo | Three tables, the commands, the reads, the internal functions, the removal pair and the load | The page shows its error state; a command rolls back as a whole |
| Checklists (U11) | `checklist_add_task` called by the pull; new internal read `checklist_task_done_state` | The pull rolls back; the task page shows its error state |
| Duties and Recurring (U9) | Read by `my_tasks_get` | My tasks shows its error state |
| TimedChecks (U5) | One registered daily check | A failing task is recorded and the others still run |
| Notifications (U5) | Two notice kinds on a new `todo_task` target | A refusal rolls the caller back; a failed email is retried and listed |
| Audit | New action names | The change rolls back |
| WebApplication | To-do list, task page, My tasks, management page, task form, pull list | The page shows its error state |
| Seed and reset | Invented tasks for demo data | No effect on rules |

## Blast Radius

The migration adds three tables and no column to any other table. It touches other units only by adding one read and registrations, never by replacing their functions. Each command runs in one transaction. The daily check isolates each task.

## Shared Resources

One Postgres database, the audit log, U5's notice registries, email queue and run record, and U11's checklist rows (written only through `checklist_add_task`).
