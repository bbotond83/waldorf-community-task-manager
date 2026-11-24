# Scalability Requirements: u11-checklists-and-templates

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families and one school year at a time: about ten templates of at most 30 sections and 300 tasks, about 30 events a year with a checklist of at most 30 sections and 300 tasks, at most 20 helpers per task. In practice a few hundred event tasks and claims a year. Every read is returned as one document by its function, so the data API's limit of 1000 rows is not reached. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.7 | A repeated click on any new command (template save, remove, restore, copy, checklist edits, claim, give up, typed helper, done, undo) returns the stored result and creates no duplicate. | Fixed-list "repeated click" test for each command. |
| NFR5.8 | Two parents taking the last free place of a task at once: one gets it and the other is told TASK_TAKEN; the claims never exceed helpersNeeded (BR165.2). | A two-at-once test, then an invariant query on claim counts. |
| NFR5.9 | Two helpers marking the same task done at once leave it done once, with one success and one VERSION_CONFLICT or TASK_DONE (BR166.1). | A two-at-once test reads the task and both results. |
| NFR5.10 | Two managers saving the same template, section, task or checklist order at once get one success and one VERSION_CONFLICT; positions stay 1 up to the count with no gap (BR160.3, BR164.1). | A two-at-once test, then an invariant query on positions. |
| NFR5.11 | A manager deleting a task while a parent takes it leaves one consistent result: the claim is made and the delete refused with TASK_HAS_CLAIMS, or the task is gone and the claim refused as unavailable (BR164.2). | A two-at-once test for each order. |
| NFR5.12 | U10 cancelling the event while a parent takes a task leaves one consistent result: the claim succeeds before the cancel, or is refused with EVENT_CLOSED after it. | A two-at-once test for each order. |
| NFR5.13 | The lock order holds: the event row first, then the checklist head, sections, checklist tasks and claims, each by ascending id; a template command never locks an event; no command locks a family row (BR170.1). | The race tests pass; no deadlock appears in repeated shuffled runs alongside U10's event commands. |
| NFR5.14 | Two copies of a template into the same empty event at once leave one copy: the second is refused with CHECKLIST_NOT_EMPTY (BR163.2). | A two-at-once test counts the sections afterwards. |
