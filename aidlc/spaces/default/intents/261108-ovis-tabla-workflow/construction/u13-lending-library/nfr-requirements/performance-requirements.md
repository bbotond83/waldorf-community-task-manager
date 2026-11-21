# Performance Requirements: u13-lending-library

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C1 and C9 in `contract-summary.md`, and `technology-stack.md`. The library starts with 14 books and is expected to grow to a few hundred; a book is borrowed a few times a year, so the book list and the book page are the things to measure.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The library list (with and without a search text) and the book page each load in under 2 seconds on the owner's computer. | This Unit extends `db:seed:large` with 300 invented books, each with a loan history and some open loans and watches (one book carrying the most watches), on the privacy allowlist; the timing is the median of 5 warm runs after one warm-up run. A test also finds a title typed without accents and in a different case, and one with a `%` in the search text. |
| NFR9.2 | Borrowing, recording a return (with the notice to every watcher, BR135.2) and adding a book each finish in under 2 seconds. | A database test times each on the large seed, with the returned book carrying the most watches in the seed. |
| NFR9.3 | The daily check `library_due_check` finishes in under 5 seconds on the large seed, with every family leaving and every open loan inside the window. | A database test times one run and a second run of the same day. |
| NFR9.4 | Each read returns one document, so a page needs one call and no call per row. The holder and owner names come from the same read. | A test counts the calls a page makes. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new screens is Hungarian, including refusal texts, the empty states, the "Elérhető" and "Kölcsönözve" marks and "korábbi tag". | Reviewed in the screenshots. |
| NFR8.2 | The library list, book page and book form are designed in Stitch first, work at phone width and by keyboard, and have no serious or critical accessibility violations. The search box and the date picker are native controls with visible labels. | Browser checks in all three browsers, and the owner's screenshot comparison. |
