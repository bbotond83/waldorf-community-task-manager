# Entities: u12-todo-and-my-tasks

The data shape for the shared to-do list, its history, the link to an event's checklist, and the two timed notices. "My tasks" and the coordinator's management page store nothing of their own. Built from `unit-of-work.md` (U12), `unit-of-work-story-map.md`, `stories.md` (US2.4, US14.1 to US14.3, US15.1, US17.1), `requirements.md` (FR1.2, FR1.3, FR2.3, FR14, FR15, FR17.3, FR17.4, FR18.1, NFR3 to NFR6, NFR10, NFR11), `components.md` (TodoList, Checklists, Duties, WebApplication), `contract-summary.md` (C1, C2, C6, C8, C9, C14 to C17) and the owner's answers Q1 to Q6 in `functional-design-questions.md`. Contains no names or contact details.

Only what this unit adds is listed. Events, checklists, parents, families, working groups and the notice records keep the shape U1, U3, U4, U5, U10 and U11 gave them. As before, a *duty* is the row today's code calls a task.

`components.md` lists a TodoTask with one `claimedBy` and a TodoTaskHistory with `change`, `changedBy` and `changedAt`. This design keeps both and adds what the owner's answers and the requirements need: the claim time, an attention flag for removals, a source key for the one-off load, the kind of change on each history row, and a small link record for tasks pulled into an event (answer Q1). The component, its responsibilities and its boundaries do not change.

## Entity Model

```yaml
entities:
  - name: TodoTask
    description: One job on the shared list, such as a repair or an improvement. Owned by a working group or by one family.
    owner: TodoList
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: ownerKind, type: enum, required: true, allowed: [workingGroup, family], note: "FR14.2" }
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup, note: "set exactly when ownerKind is workingGroup" }
      - { name: familyId, type: reference, required: false, references: Family, note: "set exactly when ownerKind is family; the kitchen-garden and back-garden tasks are owned by the back-garden family, which a super admin names (AC14.1.3)" }
      - { name: topic, type: text, required: true, min: 1, max: 200, note: "the heading of the job, FR14.3; see the assumption on topic" }
      - { name: priority, type: integer, required: false, min: 1, max: 3 }
      - { name: description, type: text, required: false, max: 2000 }
      - { name: materials, type: text, required: false, max: 500, note: "tools and materials" }
      - { name: status, type: enum, required: true, allowed: [open, in_progress, done, postponed], default: open }
      - { name: note, type: text, required: false, max: 1000 }
      - { name: notBefore, type: date, required: false, note: "a future date keeps the task out of the default view (FR14.7)" }
      - { name: deadline, type: date, required: false }
      - { name: claimedByParentId, type: reference, required: false, references: Parent, note: "one claimant at most (answer Q2); cleared on removal of that parent" }
      - { name: claimedAt, type: timestamp, required: false }
      - { name: doneAt, type: timestamp, required: false }
      - { name: doneByParentId, type: reference, required: false, references: Parent, note: "cleared on removal; the row then shows korábbi tag" }
      - { name: needsAttention, type: boolean, required: true, default: false, note: "set by a removal for an administrator to deal with (contract C16); cleared when an administrator saves the task" }
      - { name: sourceKey, type: text, required: false, unique: true, max: 200, note: "stable key of the spreadsheet row, so a second run of the one-off load makes no duplicate (contract C17)" }
      - { name: createdAt, type: timestamp, required: true }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - ownerKind workingGroup needs workingGroupId and no familyId; ownerKind family needs familyId and no workingGroupId. The group or family belongs to the task's community.
      - doneAt and doneByParentId are set only when status is done. A done task loaded by the migration may have doneAt and no doneByParentId; any other done task has doneAt.
      - status done needs doneAt; any other status has neither doneAt nor doneByParentId.
      - claimedAt is set exactly when claimedByParentId is set, except after a removal clears the claimant (then both are empty).
      - notBefore is not after deadline when both are set.
      - The sourceKey is unique among the tasks of the community.
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: TodoTask to WorkingGroup, note: optional }
      - { to: Family, cardinality: many-to-one, direction: TodoTask to Family, note: optional }
      - { to: Parent, cardinality: many-to-one, direction: TodoTask to Parent, note: "claimant and the one who marked it done" }
      - { to: TodoTaskHistory, cardinality: one-to-many, direction: TodoTaskHistory to TodoTask }
      - { to: TodoEventLink, cardinality: one-to-many, direction: TodoEventLink to TodoTask }

  - name: TodoTaskHistory
    description: One row for each change of a task, so a done task keeps its story and nobody has to remember who did what.
    owner: TodoList
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: taskId, type: reference, required: true, references: TodoTask }
      - { name: change, type: enum, required: true, allowed: [created, edited, claimed, claim_given_back, claim_freed, status_changed, marked_done, done_undone, pulled_to_event, claimant_removed, migrated], note: "the kind of change" }
      - { name: fromStatus, type: enum, required: false, allowed: [open, in_progress, done, postponed] }
      - { name: toStatus, type: enum, required: false, allowed: [open, in_progress, done, postponed] }
      - { name: actorKind, type: enum, required: true, allowed: [parent, administrator, system], note: "a super admin with no parent record is an administrator; the migration, a removal and the daily run are system" }
      - { name: changedByParentId, type: reference, required: false, references: Parent, note: "empty for administrator without a parent record, system, and after removal; shown as korábbi tag after removal" }
      - { name: eventId, type: reference, required: false, references: Event, note: "only for pulled_to_event" }
      - { name: changedAt, type: timestamp, required: true }
    constraints:
      - Rows are only added, never changed or deleted. They hold no note text, so removing a person needs to clear only changedByParentId.
      - The history of a task is read in the order changedAt, id.
    relationships:
      - { to: TodoTask, cardinality: many-to-one, direction: TodoTaskHistory to TodoTask }
      - { to: Parent, cardinality: many-to-one, direction: TodoTaskHistory to Parent, note: optional }

  - name: TodoEventLink
    description: Records that a to-do task was pulled into an event's checklist, so the task can say where it went and whether it was finished there (answer Q1).
    owner: TodoList
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: taskId, type: reference, required: true, references: TodoTask }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: checklistTaskId, type: identifier, required: true, note: "the id returned by checklist_add_task; held without a foreign key, because the checklist belongs to Checklists and its task may later be deleted" }
      - { name: pulledAt, type: timestamp, required: true }
    constraints:
      - A task is linked to one event at most once (unique on taskId and eventId); pulling it again returns the existing link (contract C15 source_ref).
      - The link never changes the task's status and is never written by Checklists.
    relationships:
      - { to: TodoTask, cardinality: many-to-one, direction: TodoEventLink to TodoTask }
      - { to: Event, cardinality: many-to-one, direction: TodoEventLink to Event }

  - name: TodoNoticeKinds
    description: Two registered notice kinds and one registered target. Not a table of its own; the values are added to the registries U5 owns.
    owner: TodoList
    change: registry values
    attributes:
      - { name: todo_changed, type: enum, required: true, note: "kind; target todo_task; text 'A teendő módosult: [téma]'" }
      - { name: todo_due, type: enum, required: true, note: "kind; target todo_task; text 'Közeleg a határidő: [téma]'" }
      - { name: todo_task, type: enum, required: true, note: "target type already named in contract C8; registered here with its facts function, which names the topic and the page path and never another person" }
    constraints:
      - The facts function returns the topic and the page path only, never a claimant, an owner family, another person or a contact detail (NFR10).
    relationships:
      - { to: TodoTask, cardinality: many-to-one, direction: notice target to TodoTask }
```

## Summary

| Entity | Owner | What it holds | Key rules |
|---|---|---|---|
| TodoTask | TodoList | One job: heading, owner (a working group or one family), priority, description, materials, status, note, "not before" date, deadline, one claimant, done mark, attention flag, source key | BR180 to BR184, BR189 |
| TodoTaskHistory | TodoList | One row for every change, with who and when | BR181.3, BR182.2, BR183.2 |
| TodoEventLink | TodoList | A task pulled into an event's checklist, and where it went | BR185.1, BR185.2 |
| Notice kinds and target | TodoList | `todo_changed`, `todo_due`, target `todo_task` | BR188.1, BR188.2 |

"My tasks" (BR186.1) and the coordinator's management page (BR187.1) are reads over entities of Duties, RecurringDuties, Events, Checklists and TodoList and add no entity.

## Assumptions

- **Topic is the heading.** `components.md` and FR14.3 give a task a topic and no separate title. The mockup cards read "topic, title". This design keeps one field, `topic`, as the heading of the job (for example "csap javítása"), 1 to 200 characters and required. A separate category can be added later without changing anything here.
- **Priority is optional**, as on checklist tasks, because the spreadsheet rows may leave it empty.
- **No delete.** The requirements say done tasks stay in the history (FR14.6). Nothing in them asks for deleting a task, so none is offered; a task that is no longer wanted is set to postponed or done with a note.
