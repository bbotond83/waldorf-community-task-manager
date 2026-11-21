# Performance Design: u13-lending-library

Sources: `performance-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` of this Unit, and C1 and C9 in `contract-summary.md`. The library holds 14 books today and a few hundred at most, so the design adds no cache, queue or index beyond what the data needs.

## Design Decisions

| Area | Decision | Serves |
|---|---|---|
| One read per page | `library_book_list` returns every book as one JSON document, with the holder's display name, the owner's display name and the availability mark already joined in. `library_book_get` does the same for one book, with the caller's own watch state. A page makes one call. | NFR9.1, NFR9.4 |
| Search in the database | The list function takes the search text and filters by title and authors. The text is lower-cased, accents are folded with a small immutable helper (`translate` over the Hungarian accented letters), and `%`, `_` and the escape character are escaped before matching. No extension is installed. | NFR9.1 |
| No paging | The list returns all books: a few hundred rows stay far under the data API's 1000-row limit and one screen needs the whole list for search by eye. | NFR9.1 |
| Indexes | Only the ones the rules need: the partial unique index on open loans by book (also serves "who holds it"), an index on loans by borrower family for the daily check, and one on watches by book. No text index: a scan of a few hundred rows is well inside the target. | NFR9.1, NFR9.3 |
| Return with watchers | One transaction: lock the book, close the loan, send the notices in one `notice_send` call for all watchers, delete the watches. Cost grows with the number of watchers on one book, which is a few at most. | NFR9.2 |
| Daily check | One set-based selection of the due loans (open loans joined to families leaving this year), then one `notice_send` call per loan with that family's active parents as the recipient array and the once key; there is no loop per family or per parent. It reads only open loans, so a second run selects the same rows and sends nothing new. | NFR9.3 |
| Screens | Server-rendered pages calling one read each; the search is a plain form (GET) with a native text box, so no client script is needed for it. | NFR9.4, NFR8.2 |
| Language | All new text lives in the existing Hungarian copy module; refusal codes map to Hungarian texts in one place. | NFR8.1 |

## Measuring

- The large seed (`db:seed:large`) gains 300 books with a loan history, open loans and watches (one book carries the most watches in the seed). The seed support code is extended in Code Generation; without it NFR9.1 to NFR9.3 cannot be measured.
- Each timing is the median of 5 runs after one warm-up run, on the owner's computer, so a single slow run does not fail it and a single fast run does not hide a slow query.
- The page-call count (NFR9.4) is asserted by a test that counts data calls per page.
- Borrow and add-book timings (NFR9.2) are measured the same way as return: a database test on the large seed, median of 5 runs, one test per command.
- `library_list` and `library_get` return the C1 result envelope with the data beside it (as U5's `notification_list` returns its `items`), so a denied or failed read is a refusal and never an empty list (NFR3.2, NFR4.9).

## Screens

The list, book page and book form are designed in Stitch first and checked by the owner against screenshots (NFR8.2). They use the `library-` class prefix: this is a new area prefix under the team's rule that new areas get their own, not an existing one. Class names are kebab-case.
