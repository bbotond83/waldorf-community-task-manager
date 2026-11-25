# Scalability Requirements: u12-todo-and-my-tasks

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families: a few hundred to-do tasks including done ones, each with a handful of history rows, and at most 50 tasks pulled per call. Every read returns one document and the list is cut at 500 tasks with a note, so the data API's limit of 1000 rows is not reached. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.15 | A repeated click on any new command returns the stored result and creates no duplicate task, history row, link or notice. | Fixed-list "repeated click" test for each command. |
| NFR5.16 | Two parents claiming the same task at once: one succeeds and the other is told TODO_CLAIMED; the task has one claimant (BR182.1). | A two-at-once test, then an invariant query. |
| NFR5.17 | The claimant marking done while an administrator frees the claim or edits the task leaves one consistent result: one succeeds and the other gets VERSION_CONFLICT or TODO_DONE (BR183.2). | A two-at-once test for each order. |
| NFR5.18 | Two managers saving the same task at once get one success and one VERSION_CONFLICT (BR181.3). | A two-at-once test. |
| NFR5.19 | A claim racing U14's removal of the claimant leaves no live claim for a removed parent (NFR3.25). | A two-at-once test for each order. |
| NFR5.20 | Two pulls of overlapping tasks into different events at once, and a pull racing a claim or an edit of a selected task, do not deadlock; the second gets a conflict if a selected task's version changed (BR185.1, BR189.1). | Repeated shuffled runs alongside U11's checklist commands show no deadlock. |
| NFR5.21 | Pulling the same task into the same event twice, also at once, creates one checklist task and one link (BR185.1). | A two-at-once test counts both. |
| NFR5.22 | The lock order holds: the event row, the checklist rows, then the to-do rows ascending; no command locks a family row, and no checklist command locks a to-do row (BR189.1). | The race tests pass in repeated shuffled runs. |
