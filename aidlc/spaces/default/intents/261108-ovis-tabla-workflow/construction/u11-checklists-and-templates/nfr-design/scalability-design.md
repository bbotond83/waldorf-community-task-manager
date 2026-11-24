# Scalability Design: u11-checklists-and-templates

How the targets in `scalability-requirements.md` are met, following `functional-spec.md` and C1 in `contract-summary.md`. One community needs no scaling mechanism; the design is about correct behaviour when two people act at once.

## Locking

| Command | Lock order |
|---|---|
| Claim, give-up, typed helper, done, undo, claim change | Event row `for share`, then the task row `for update`, then the claim row when it changes one |
| Copy, section and task save or remove, reorder, `checklist_add_task` | Event row `for share`, then the checklist head `for update` (created inside the lock if missing), then sections ascending, then tasks ascending, then claims ascending when checked |
| Template save, remove, restore | Template row `for update`, then its sections and tasks; never an event |
| Removal pair (U14) | Checklist tasks ascending, then their claims ascending; no event lock |
| U10's `event_save_core` (cancel, change) | Event row `for update`, as before; reads `checklist_claimant_ids` without locks |

Every checklist path takes locks in the same direction (event, head, section, task, claim), and no command of this Unit locks a family row (NFR5.13). A caller from another unit may already hold one: U12's `todo_pull_to_event` may lock a family (and its to-do rows) before it calls `checklist_add_task`. The contract for callers is the C1 order: a family row, if any, first, then the event row and the checklist rows; a caller never calls into this Unit while it holds a checklist row and then locks a family. This is recorded as a C15 note for U12. Because claim and checklist commands hold the event row `for share`, U10's cancel (`for update`) waits for them and they wait for it: a claim either finishes before the cancel or sees the cancelled event (NFR5.12). Two claims on one event share the event lock and meet only at the task row.

Row-based commands first read the row's event and task without a lock, then lock in the order above and check again that the row still belongs to them.

## Repeated and concurrent actions

| Requirement | Design |
|---|---|
| NFR5.7 | Each command takes an idempotency key and stores its result through the existing platform helper; a repeat returns it. |
| NFR5.8 | Claims are counted after the task row lock, so the last place goes to one caller and the other gets TASK_TAKEN. A deferred constraint trigger, like today's `assignments_check_capacity`, locks the task and recounts at commit as the database's own last word. |
| NFR5.9 | Done and undo check the task's version under its lock; the second caller gets VERSION_CONFLICT, or TASK_DONE when it sent the new version. |
| NFR5.10 | Template, section and task saves check their own version under the lock; reorder checks the checklist head's version. Positions are unique per parent with deferrable constraints, rewritten as 1 up to the count in one statement. |
| NFR5.11 | Deleting a task locks it, then checks for claims and a done mark; a claim waiting on the same row then finds it gone and answers CHECKLIST_TASK_UNAVAILABLE. |
| NFR5.14 | The copy locks the checklist head, so the second copy finds sections and answers CHECKLIST_NOT_EMPTY. |

## Capacity

The 1000-row limit of the data API is not reached because each read returns one document.
