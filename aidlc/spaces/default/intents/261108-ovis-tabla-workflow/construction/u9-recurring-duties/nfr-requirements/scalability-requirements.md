# Scalability Requirements: u9-recurring-duties

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 and C9 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families and one school year at a time: about 20 schedules, each creating one occurrence every 1 to 6 weeks, so at most a few hundred occurrences are open or recent at any time and roughly 500 a year; a few hundred notices a year. Every read is returned as one document by its function, so the data API's limit of 1000 rows is not reached (overdue older than 60 days are left out, BR146.3). No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any command (save schedule, switch on or off, mark done, undo, skip) returns the stored result and creates no duplicate. | Fixed-list "repeated click" test. |
| NFR5.2 | Two people marking the same occurrence done at once get one success and one conflict; the done mark names one person and one time (BR145.2). | A two-at-once test, then a read of the row. |
| NFR5.3 | A mark-done racing with an undo or a skip of the same occurrence ends done then open, or skipped with the mark refused with RECURRING_CLOSED, never done and skipped together. | A two-at-once test for each order. |
| NFR5.4 | Two coordinators saving the same schedule at once get one success and one VERSION_CONFLICT. | A two-at-once test. |
| NFR5.5 | A schedule save racing with the daily check leaves one occurrence per schedule and due date, none duplicated and none lost for the new rule (BR143.3, BR144.1). | A two-at-once test, then a uniqueness query. |
| NFR5.6 | Two runs of the daily check at once, or the check racing with a switch-off, create each occurrence and each notice once. | A two-at-once test counts occurrences and notices. |
| NFR5.7 | A swap or reassignment of a water week racing with a mark-done on its cleaning occurrence is judged on the family that holds the week at commit: the mark succeeds for the holder before the swap or is refused for the old holder after it (BR147.2). | A two-at-once test for each order. |
| NFR5.8 | The lock order of C1 holds and states where this Unit's rows fit: a command that reads a family or a rota week for its owner check takes that lock first (family, then rota week), then the schedule row, then occurrence rows by ascending id. No command locks a family or rota week after a schedule row. This answers the open point of the design review about the schedule row's place in the order. | The race tests pass; no deadlock appears in repeated runs; the order is written into the Unit's test notes. |
