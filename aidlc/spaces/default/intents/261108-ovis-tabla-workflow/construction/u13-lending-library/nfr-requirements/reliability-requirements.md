# Reliability Requirements: u13-lending-library

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9, C16 and C17 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Recording a return is all-or-nothing: the loan's return, the book's version, the watchers' notices, the deletion of the watches and any audit entry commit together or not at all (BR134.1, BR135.2). The notices go only to active watchers other than the person recording the return, so the notification function has no expected refusal; if it ever raises, the return rolls back and can be retried, while a failed email never does. | A forced failure midway leaves the book borrowed. A failed email leaves the return recorded and the in-app notice in place. |
| NFR7.2 | Borrowing is all-or-nothing: the loan, the book's version and the deletion of the borrower's own watch are written together (BR133.1). | A forced failure between them leaves none. |
| NFR7.3 | The database itself refuses a second open loan on one book, an owner that is both a parent and a typed name, a typed name without a source key, a return before the borrowing, an "until when" date outside the allowed range, a second watch by one parent on one book, and a title, authors or description over its limit. | A test tries each directly as the database owner. |
| NFR7.4 | The reminder's window is computed in Budapest dates, including in the weeks where the clocks change: it opens on the changeover date minus 30 days and closes the day before the changeover date (BR136.1). | Tests set the moment just before and after each end of the window, in both clock-change weeks. |
| NFR7.5 | The new tables and functions apply over a seeded database without touching existing rows; there is no library data in the code today. | A test applies the migration over a seeded database and compares row counts of the existing tables. |
| NFR7.6 | A failing `library_due_check` is recorded and the other checks still run; a second run the same day sends nothing more (BR136.2, contract C9). | A forced failure in the check, then two runs. |
| NFR7.7 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables, notice kinds and target type. | The scripts name the file and both catalogue tests pass. |
| NFR6.4 | The functions delivered for later units are tested directly, because no screen of this Unit calls the daily check, the removal pair or `migration_load_book`; the load is tested with an invented workbook's rows only, a second call with the same key creates nothing (BR140.1), and a bad row's refusal contains no cell value, only a code and the row position (C17). The load writes no audit entry; the run-level report belongs to the migration script unit. | A database test file calls each as the database owner or the service role. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The removal preview and apply functions report and clear a person's watches, closed-loan links and owner links, flag open loans held, and return zero counts for a subject they hold nothing for (BR139.1). | A test calls the pair for a parent and for a family, and reads the rows afterwards. |
| NFR11.2 | The registry row `library_return_due` is added by this Unit's migration without editing U5's function, and the existing timed-run tests pass with it registered (BR136.2). | The existing timed-run tests pass and a test reads the registry. |
