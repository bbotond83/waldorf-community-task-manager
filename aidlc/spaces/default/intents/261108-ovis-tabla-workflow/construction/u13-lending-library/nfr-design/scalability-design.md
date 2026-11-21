# Scalability Design: u13-lending-library

Sources: `scalability-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. One community of about 20 families, up to a few hundred books and a few dozen watches at a time, so no scaling mechanism is designed. The design is about correct behaviour when two people act at once.

## Concurrency Design

| Concern | Design | Serves |
|---|---|---|
| Repeated click | Every command takes the C1 idempotency key and returns the stored result for a key already used, before any check or change. | NFR5.1 |
| Two borrows | The function locks the book row, then reads the open loan. The second caller waits, sees the open loan and is refused with BOOK_NOT_AVAILABLE. The partial unique index on open loans is the last guard if a lock were ever skipped. | NFR5.2 |
| Two returns | The return locks the book and re-reads its open loan under the lock; the second caller finds no open loan and gets one refusal (version check first, so VERSION_CONFLICT when the screen was outdated, BOOK_NOT_ON_LOAN otherwise). The notices are sent inside the winner's transaction only, once key `book_returned` plus loan id. | NFR5.3 |
| Return against watch | The watch function takes the same book lock. Watch first: the return then tells and deletes it. Return first: the watch function finds no open loan and refuses with BOOK_AVAILABLE. | NFR5.4 |
| Removal against borrow | Both lock the book. Borrow first: removal is refused with BOOK_ON_LOAN. Removal first: borrow is refused as the book is removed. | NFR5.5 |
| Lock order | Book row last in the C1 order, then its loan and watch rows by ascending id. No command touches two books. The removal block locks the family row first, then that family's books by ascending id, then the loans and watches. A wrapper never adds a lock just to check standing (project rule from U6). | NFR5.6 |
| Daily check twice at once | The check sends through `notice_send` with the once key `book_return_due` plus loan id per parent, so a second run, at once or later, sends nothing new. No lock on the book is taken. This is recorded as an accepted exception to the C1 lock rule and to "nothing is sent for a returned book" in BR136.1 (BR136.2 states it too), instead of re-reading the loan inside the sending statement: a return during a run can still send a reminder for a book already back, and the notice text names the book only, so the harm is one harmless extra notice. | NFR5.7 |

## Capacity

- The list read returns all books in one document; at a few hundred books it stays well under 1000 rows. If the library ever passes that, the list needs paging; this is a limit to watch, not a design for now.
- The daily check reads open loans only; the number of open loans is at most the number of books.
- Nothing here needs a queue, a cache or more than one database connection per request.

## Testing the Races

The two-at-once tests use the existing helper that runs two sessions against the real local database; each ordering named above gets its own test, and each case repeats 20 times inside the test file to catch deadlocks; the shuffled run is also repeated several times before the owner review.
