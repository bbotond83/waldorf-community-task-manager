# Scalability Requirements: u10-events-and-signups

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families and one school year at a time: about 30 events, at most 10 notices and 20 roles each, at most 10 sign-ups per parent per event and 20 offers per parent per event, so a few hundred sign-ups and offers a year, and a few dozen notices. Every read is returned as one document by its function, so the data API's limit of 1000 rows is not reached. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any new or changed command (save event, notices, tale, role, sign-up, offer, withdraw, cancel) returns the stored result and creates no duplicate. | Fixed-list "repeated click" test. |
| NFR5.2 | Two parents adding sign-ups or offers at once reach their own limits (10 sign-ups, 20 offers) without exceeding them: the one that would pass the limit is refused. | A two-at-once test fires the last allowed add twice and counts rows. |
| NFR5.3 | A manager's save of notices racing with another manager's save of the same event gets one success and one VERSION_CONFLICT; the notice positions stay 1 up to the count with no gap. | A two-at-once test, then an invariant query on positions. |
| NFR5.4 | A manager cancelling an event while a parent adds a sign-up or offer leaves one consistent result: the add succeeds before the cancel or is refused with EVENT_CLOSED after it. | A two-at-once test for each order. |
| NFR5.5 | A change and a withdrawal of the same sign-up at once leave the sign-up changed then gone, or gone with the change refused, never both applied. | A two-at-once test reads the row and the results. |
| NFR5.6 | The lock order of C1 holds: the event row first, then its notice, role, sign-up and offer rows by ascending id, then task rows (BR122.1). A command never locks a family row after an event row. | The race tests pass; no deadlock appears in repeated runs. |
