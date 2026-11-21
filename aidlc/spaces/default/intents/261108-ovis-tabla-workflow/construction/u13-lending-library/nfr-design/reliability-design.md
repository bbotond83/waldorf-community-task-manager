# Reliability Design: u13-lending-library

Sources: `reliability-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9, C16 and C17 in `contract-summary.md`. Nothing is hosted in this work, so no availability design applies; the design is about data staying correct.

## Transaction Design

| Step | Design | Serves |
|---|---|---|
| Return | One function, one transaction: lock book, close loan, raise the version, clear a removed borrower's links, send the watchers' notices, delete the watches, write the audit entry when it applies. Any raised error rolls back all of it. | NFR7.1 |
| Borrow | One transaction: create the loan, raise the version, delete the borrower's own watch. | NFR7.2 |
| Notices | `notice_send` records the in-app notice and queues the email. The recipient list is the active watchers other than the caller recording the return (BR135.2), so a super admin who also holds a watch is not told of their own action; the return test covers this. A failed email later is U5's delivery failure and never touches the return. | NFR7.1 |

**Which failures roll back the return.** The notice call is made only for parents who are active and have a watch, so a refusal from the notice function is not an expected outcome; if it happens it is a fault (for example a missing registry row), and the function lets it raise so the return rolls back and can be retried. A failed email is not a refusal and never raises here. This resolves the difference between the two readings: a refusal rolls back, a failed delivery does not.

## Database Guards (NFR7.3)

The migration adds checks that the database itself enforces: one open loan per book (partial unique index), an owner that is a parent or a typed name but not both, a typed name only with a source key, a return not before the borrowing, an until date within the allowed range, one watch per parent per book, and the three length limits. A test attacks each as the database owner.

## Time Design (NFR7.4)

All date comparisons use Budapest dates: the reminder window opens on the changeover date minus 30 days and closes the day before the changeover date. The function takes the moment of the run as a parameter, so a test sets the moment just before and after each end of the window, including the two weeks where the clocks change.

## Daily Check Design (NFR7.6, NFR11.2)

The registry row is inserted by this Unit's migration with these values: check name `library_return_due`, function `library_due_check`, run kind `daily`, active, and the `lock_step` that places it last (the registry accepts 1 to 4; Code Generation reads the existing rows and uses the highest value so the check runs after them, BR136.2). U5's function is not edited. The runner already records each check's outcome and isolates failures, so a failing library check is recorded and the other checks still run. A second run on the same day sends nothing more, by the once key.

## Migration Design (NFR7.5)

The migration only creates new tables, functions, registry rows and notice kinds; it never updates or deletes an existing row. A test applies it over a seeded database and compares row counts of the existing tables. There is no library data in the code today. Recovery is forward-only: a defect is fixed by a new migration file.

## Removal Pair (NFR11.1)

`library_removal_preview` and `library_removal_apply` follow the C16 shape: preview reports the counts, apply clears a person's watches, closed-loan links and owner links, and flags the open loans held (the flag count is returned for the later unit to act on). For a subject that holds nothing they return zero counts. The family variant locks the family first, then books by ascending id.

## Verification Gate (NFR7.7)

Every change passes `npm run verify:local` and the `Validate` check in all three browsers; the new database test files are added by hand to their `test:database:*` script and to the shuffled run (NFR6.3).

## Testing Design

| ID | Design |
|---|---|
| NFR6.1 | No coverage change: application code stays at 80% or more; the database part is covered by the next row. |
| NFR6.2 | The test plan has one row per rule and one column per item of the fixed list; a cell names a test or says "nem értelmezhető" with its reason. |
| NFR6.3 | The new files are listed in their script and the shuffled run; `identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `notification-use-cases.test.ts` are extended for the new functions, tables, notice kinds and target type. |
| NFR6.4 | One database test file calls the daily check, the removal pair and `migration_load_book` directly as the database owner or service role; the load is fed an invented workbook's rows only, checks a second call with the same key creates nothing, and checks a bad row returns a code with no cell value. |
