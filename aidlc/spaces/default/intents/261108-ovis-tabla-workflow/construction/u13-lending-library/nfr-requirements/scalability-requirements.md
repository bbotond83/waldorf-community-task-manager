# Scalability Requirements: u13-lending-library

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families: 14 books at the start, a few hundred at most, each borrowed a few times a year, so a few hundred loans a year and a few dozen return watches at a time. The list read returns every book as one document, so the data API's limit of 1000 rows is not reached. The daily check reads only open loans. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any new command (add, change, remove, borrow, set date, return, watch add and remove) returns the stored result and creates no duplicate. | Fixed-list "repeated click" test. |
| NFR5.2 | Two parents borrowing the same book at once get one loan and one refusal; the book never has two open loans, which the database also refuses (BR133.2). | A two-at-once test counts open loans and reads both results. |
| NFR5.3 | Two people recording the same return at once (the owner twice, or the owner and a super admin) get one success and one refusal, and the watchers are told once (BR135.2). | A two-at-once test counts the notices. |
| NFR5.4 | A return racing with a watch request on the same book leaves one consistent result: the watch is created before the return and told, or refused with BOOK_AVAILABLE after it. | A two-at-once test for each order. |
| NFR5.5 | A removal of a book racing with a borrow leaves one consistent result: the borrow succeeds and the removal is refused with BOOK_ON_LOAN, or the removal succeeds and the borrow is refused. | A two-at-once test for each order. |
| NFR5.6 | The lock order of C1 holds: the book row (the last step) and then its loan and watch rows by ascending id; no command touches two books (BR138.1). The removal block locks the family first, then books by ascending id. | The race tests pass; no deadlock appears in repeated runs. |
| NFR5.7 | The daily check run twice at once sends each reminder once, by the once key. | A two-at-once test counts the notices. |
