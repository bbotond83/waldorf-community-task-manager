# Business Rules: u13-lending-library

Built from `unit-of-work.md` (U13), `unit-of-work-story-map.md`, `stories.md` (US16.1 to US16.3, US17.1), `requirements.md` (FR1.2, FR1.6, FR16, FR17.4, FR18.1, NFR3 to NFR5, NFR10), `components.md`, `contract-summary.md` (C1, C2, C3, C6, C8, C9, C16, C17, C20), `decisions.md` and `functional-design-questions.md` (Q1 to Q7). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about reach still hold. Contains no names or contact details.

All times are Budapest time. A book is *available* when it is not removed and has no open loan, and *borrowed* while it has an open loan (a loan with no return recorded). The *owner with rights* is the active parent named in `ownerParentId`; a book with a typed owner name, or whose owner was removed, has none.

## Rules

```yaml
rules:
  # --- Who sees the library ----------------------------------------------------------------
  - id: BR130.1
    statement: Every signed-in person of the community reads the book list and every book, and a teacher reads and changes nothing.
    category: authorization
    applies_to: [Book, Loan]
    trigger: library_list, library_get
    logic: can_read_community (C2) lets a parent, a group admin, a super admin and a teacher read. A teacher is refused by every command of this unit (denied). A caller outside the community, or without an active session, gets the denied refusal and never an empty list. Tables are not readable directly (the team's rule); everything goes through the functions. A removed book answers as if it did not exist.
    violation: Denied refusal (authorization_denied).
    source: FR1.2, FR1.6, AC16.1.1, contract C1, contract C2
  - id: BR130.2
    statement: The list shows each book with where it is now, can be searched, and never breaks when a description is missing.
    category: policy
    applies_to: [Book, Loan]
    trigger: library_list, library_get
    logic: Each row returns the title, the authors, the description or nothing, the owner and the state. The owner and the holder are shown through C6 (parent_display_name), so a removed person shows as korábbi tag and a typed owner name shows as typed. A borrowed book also shows the holder and the "until when" date when there is one. An available book shows no holder. The list takes an optional search text and returns the books whose title or authors contain it, ignoring case and accents, ordered by title. Nothing in the result is a phone number, an email address or a child's name. The screen shows a book with no description as a title and authors only.
    violation: Not applicable; a read.
    source: FR16.1, AC16.1.2, Q5, contract C6
  # --- Adding, changing and removing a book --------------------------------------------------
  - id: BR131.1
    statement: Any parent adds a book, with a title, authors and an optional description.
    category: validation
    applies_to: [Book]
    trigger: library_book_add
    logic: The caller must be an active parent, group admin or super admin (a teacher is refused). The title is required, 1 to 200 characters after trimming. The authors are required, 1 to 200. The description is optional, up to 1000. The book is added to the caller's community and is available. The adder is its owner unless BR131.2 names another. A second book with the same title and authors is allowed, because it is a second copy.
    violation: Denied refusal, or validation refusal on title, authors or description.
    source: FR16.2, AC16.1.1, Q1
  - id: BR131.2
    statement: The owner is the adder, or another active parent the adder names.
    category: validation
    applies_to: [Book]
    trigger: library_book_add, library_book_change
    logic: The owner defaults to the caller. A caller may instead name another active parent of the community who has an account, including a group admin or a super admin. A teacher, a removed parent, a parent of another community and an unknown id are refused on the owner field. A typed owner name cannot be given by a signed-in caller; it exists only on books loaded from the spreadsheet (BR140.1).
    violation: Validation refusal on owner (unknown or not_a_parent).
    source: AC16.1.1, Q1
  - id: BR132.1
    statement: The owner and a super admin change a book's title, authors, description and owner.
    category: authorization
    applies_to: [Book]
    trigger: library_book_change
    logic: Only the owner with rights or a super admin; a coordinator, another parent, a teacher and a caller with no session are refused. The book's version must match what the caller saw. The title, authors and description follow BR131.1 and the new owner BR131.2. Naming an owner on a book that holds a typed owner name clears the typed name, so a book never has both. A new owner who currently holds the book is refused on the owner field (holder_or_owner), and a watch the new owner has on the book is deleted in the same change, so a holder or a watcher never becomes the owner while keeping a watch. A removed book cannot be changed. A change while the book is borrowed is allowed and does not touch the loan; the new owner then records the return. A change by a super admin who is not the owner is audited (BR139.2).
    violation: Denied, conflict (VERSION_CONFLICT) or validation refusal on the field; BOOK_REMOVED for a removed book.
    source: Q1, Q2, FR16.1
  - id: BR132.2
    statement: The owner and a super admin remove a book while nobody holds it.
    category: constraint
    applies_to: [Book, ReturnWatch]
    trigger: library_book_remove
    logic: Only the owner with rights or a super admin. The book's version must match. IF the book has an open loan THEN refuse. Otherwise removedAt is set, the book's return watches are deleted without any notice, the version goes up, and the book leaves every list. Its closed loans stay as history. Removing cannot be undone from the app. A removal by a super admin who is not the owner is audited (BR139.2).
    violation: Denied, conflict (VERSION_CONFLICT) or BOOK_ON_LOAN.
    source: Q2
  # --- Borrowing and returning ---------------------------------------------------------------
  - id: BR133.1
    statement: A parent with a family borrows an available book that is not their own.
    category: validation
    applies_to: [Book, Loan]
    trigger: library_book_borrow
    logic: The caller must be an active parent, group admin or super admin with a family (current_family_id, C2); a teacher and a caller with no family are refused. The book must exist and not be removed. The caller sends the book's version. IF the caller is the book's owner THEN refuse on book (own_book). IF the book has an open loan THEN refuse with BOOK_NOT_AVAILABLE. Otherwise one loan is created with the caller, the caller's family, the moment of borrowing and the optional until date of BR133.3, the book's version goes up, and the caller's own return watch on the book, if any, is deleted. There is no limit on how many books one person holds. A family member other than the owner may borrow a book of the same family.
    violation: Denied, validation refusal on book (own_book or not_found), BOOK_NOT_AVAILABLE or conflict (VERSION_CONFLICT).
    source: FR16.3, AC16.2.1, Q4
  - id: BR133.2
    statement: Two people borrowing a book at the same moment get one loan and one refusal.
    category: constraint
    applies_to: [Book, Loan]
    trigger: library_book_borrow
    logic: The command locks the book row before it reads the loan (BR138.1), so two simultaneous commands run one after the other. The first creates the loan and raises the book's version; the second then finds either a different version or an open loan and is refused. The database also refuses a second open loan on a book as a last guard. A repeated click with the same key returns the first result and creates no second loan.
    violation: Conflict (VERSION_CONFLICT or BOOK_NOT_AVAILABLE); the loser changes nothing.
    source: AC16.2.4, NFR3, NFR5
  - id: BR133.3
    statement: The "until when" date is optional, is only shown, and the borrower may change it.
    category: policy
    applies_to: [Loan]
    trigger: library_book_borrow, library_loan_set_until
    logic: The date is optional. When given it is not before today and not more than one year ahead. Only the borrower of the open loan may later set, change or clear it, with the loan's version, and a closed loan cannot be changed. Nothing is sent and nothing changes when the date passes (no reminder, no flag, no state change); the screen only shows it.
    violation: Validation refusal on until (before_today or too_far), denied for anyone but the borrower, VERSION_CONFLICT, or BOOK_NOT_ON_LOAN for a closed loan.
    source: AC16.2.1, Q7
  - id: BR134.1
    statement: Only the owner records a return, and anyone else is refused.
    category: authorization
    applies_to: [Book, Loan]
    trigger: library_book_return
    logic: The caller must be the active owner with rights of the book. The borrower, another parent, a coordinator and a teacher are refused, and a super admin only under BR134.2. The book's version must match. IF the book has no open loan THEN refuse with BOOK_NOT_ON_LOAN (the version is checked first, so a screen that is out of date, for example after the owner or a super admin has just recorded the return, gets VERSION_CONFLICT, and BOOK_NOT_ON_LOAN comes only with a current version; the screen shows the same Hungarian text for both). Otherwise the loan's returnedAt is set to now, the book's version goes up and the book is available again. IF the loan's borrower has been removed THEN the loan's borrower links are cleared in the same step (BR139.1). The return watches are handled by BR135.2 in the same transaction.
    violation: Denied, conflict (VERSION_CONFLICT) or BOOK_NOT_ON_LOAN; nothing changes.
    source: FR16.3, AC16.2.2, AC16.2.3
  - id: BR134.2
    statement: A super admin records the return of a book that has no owner with rights.
    category: authorization
    applies_to: [Book, Loan]
    trigger: library_book_return
    logic: IF the book has no owner with rights (a typed owner name, or an owner who was removed) THEN a super admin may record the return, with the same checks and effects as BR134.1, and the action is audited (BR139.2). For a book that has an owner with rights a super admin who is not that owner is refused.
    violation: Denied refusal for anyone else.
    source: Q3, AC16.2.3
  # --- Being told when a book is back ---------------------------------------------------------
  - id: BR135.1
    statement: A parent asks to be told when a borrowed book is back, and may take the request back.
    category: validation
    applies_to: [ReturnWatch]
    trigger: library_watch_add, library_watch_remove
    logic: The caller must be an active parent, group admin or super admin (a teacher is refused). The book must exist and not be removed. IF the book has no open loan THEN refuse with BOOK_AVAILABLE, because the parent can borrow it. IF the caller holds the book or owns it THEN refuse on book (holder_or_owner). IF the caller already has a watch on the book THEN refuse with ALREADY_WATCHING and create nothing. Otherwise one watch is created. A caller removes only their own watch; removing one that does not exist succeeds and changes nothing. A watch asks for one notice only.
    violation: Denied, BOOK_AVAILABLE, ALREADY_WATCHING or validation refusal on book.
    source: FR16.4, AC16.3.1
  - id: BR135.2
    statement: When the book is returned, everyone who asked is told once, and the requests end.
    category: policy
    applies_to: [ReturnWatch, Notice]
    trigger: library_book_return, contract C8
    logic: In the same transaction as the return, notice_send (C8) is called with kind book_returned and target type book for the parents who hold a watch on the book and are still active, without the person recording the return. The once key is book_returned plus the loan id, so the same loan never tells the same parent twice. Then every watch on the book is deleted, so a parent who wants the next return asks again. A failed email never fails the return and the in-app notice remains (U5 shows the failure). A book with no watches sends nothing.
    violation: Not applicable; a failed send is recorded by U5.
    source: FR16.4, AC16.3.1, AC17.1.1, contract C8
  # --- The reminder to a leaving family ---------------------------------------------------------
  - id: BR136.1
    statement: A leaving family that still holds a book gets one reminder 30 days before the changeover date.
    category: policy
    applies_to: [Loan, Notice]
    trigger: the daily run, check library_return_due
    logic: IF the school year of today exists (school_year_for, C3) THEN for every open loan whose borrower family is leaving in that year (families_with_standing, C20) and whose book is not removed, IF today is on or after the changeover date (changeover_date, C3) minus 30 days and before the changeover date THEN every active parent of that family who has an account gets the notice book_return_due naming the book and the changeover date. The once key is book_return_due plus the loan id, so each parent gets it once per loan whatever the number of runs. A run made later in the window still sends what is not yet sent. Nothing is sent from the changeover date on, for a returned book, for a family that is staying or new, or for a loan whose family link is cleared. A book borrowed or a family marked leaving after the 30-day day still gets its reminder at the first run on or after that moment while the window is open. The owner is not told.
    violation: Not applicable.
    source: FR16.5, AC16.3.2, Q6, contract C20, contract C3
  - id: BR136.2
    statement: The check is registered in the daily run, is safe to run twice, and runs without anyone signed in.
    category: constraint
    applies_to: [TimedCheck]
    trigger: the daily run
    logic: This unit's migration inserts one row into the run's registry, with check name library_return_due, function library_due_check, run kind daily and the run order of the book step in contract C1, which comes last. library_due_check(now) takes the moment of the run, reads only open loans and returns how many notices it created and how many loans it skipped because nobody new needed telling. It is internal and never granted to a signed-in user. U5's function is not edited. A failing check is recorded and the other checks still run (contract C9). The check takes no book lock. This is an accepted exception to the lock rule of C1 and to "nothing is sent for a returned book" in BR136.1: a return recorded during a run can still produce one reminder for a book that has just come back, and the notice names only the book, so the harm is one extra notice.
    violation: A failure is recorded in timed_check_runs and shown to a super admin.
    source: FR17.3, AC17.1.3, AC17.1.5, contract C9
  - id: BR137.1
    statement: A book notice links to the book and carries no other person's details.
    category: constraint
    applies_to: [NoticeTarget, NoticeKind]
    trigger: notice_send, the book facts function
    logic: The notice's target is the book and it opens /szulo/konyvtar/[id]. Its text is the Hungarian title prefix with the book's title ("Könyv visszaérkezett", "Könyvet vissza kell vinni") and, for the reminder, the changeover date. It never names the holder, the owner, the other watchers or any contact detail. A notice for a book that was later removed is still delivered and its link answers as an unknown book. Delivery, retries, no double sending and the failure list are U5's (AC17.1.2 to AC17.1.5).
    violation: Not applicable.
    source: AC17.1.1, AC17.1.4, AC17.1.6, FR17.4, NFR10, contract C8
  # --- Locks, repeats, audit, removal and the one-off load ---------------------------------------
  - id: BR138.1
    statement: Every library command locks in a fixed order and is safe to repeat and to run twice at once.
    category: constraint
    applies_to: [Book, Loan, ReturnWatch]
    trigger: every command of this unit
    logic: A command takes the book row first (the book step of contract C1, the last step), then its loan row and then its watch rows, each by ascending id. No command of this unit touches two books. Every command takes an idempotency key and a repeated key returns the stored result; a command that changes an existing record also takes that record's version. A key reused with other content is a conflict. The removal block locks as contract C16 orders it, the family first, then books by ascending id: apply first collects every affected book id (books the subject owns, books with the subject's watches, and books held or lent by the subject), locks them ascending, and only then locks the loan and watch rows ascending.
    violation: Conflict refusals idempotency_key_reused and VERSION_CONFLICT.
    source: NFR3, NFR5, contract C1
  - id: BR139.1
    statement: Removing a parent or a family clears their links and ends their requests, and flags what they still hold.
    category: constraint
    applies_to: [Book, Loan, ReturnWatch]
    trigger: library_removal_preview and library_removal_apply (contract C16)
    logic: For a parent, or for every parent of a family, the block does four things. It deletes the subject's return watches. It clears the borrower links of the subject's closed loans (the parent and, for a family, every closed loan of that family), keeping the rows so that a book's history stays whole. It clears ownerParentId on the books the subject owns, which stay in the list and show korábbi tag as owner; the books of an owner who is borrowed out stay borrowed. It flags, and does not change, the open loans the subject still holds, so that an administrator sees the held books (U14); nothing is stored as a flag, the flag is the list the block returns. Preview returns to_clear, the watches plus the cleared loans plus the cleared owners, to_flag, the number of open loans held, and held_loan_ids, the opaque ids of those loans in ascending order, with no title or name, so U14 can list the held books through the book read. Apply returns the same counts and ids in the same transaction as the removal. A held book's borrower links are cleared when its return is recorded (BR134.1). A block returns zero counts for a subject it holds nothing for.
    violation: Not applicable; internal.
    source: contract C16, AC3.6.5, FR16.5
  - id: BR139.2
    statement: Administrator actions on books are audited without names or titles.
    category: policy
    applies_to: [Book, Loan]
    trigger: a super admin's return, change or removal of a book they do not own; a change of owner by a super admin; removal apply
    logic: One audit entry records the action, the actor and the target ids. It never holds a title, an author, a name or a description. An ordinary add, borrow, return or request by the owner or the borrower is not an administrator intervention and is not audited. The change rolls back when the entry cannot be written. The audit actions are library_book_returned_by_admin, library_book_changed_by_admin, library_book_removed_by_admin, library_owner_changed_by_admin and library_removal_applied (one entry per applied removal, with counts and no ids of people beyond the opaque subject id); they are added to the C1 audit list. migration_load_book writes no audit entry: the load is a one-off run by the migration script, which reports counts only (BR140.1).
    violation: The change rolls back.
    source: NFR4, NFR5, contract C1
  - id: BR140.1
    statement: The one-off load adds a book once per spreadsheet row, as an available book.
    category: constraint
    applies_to: [Book]
    trigger: migration_load_book(source_key, payload) (contract C17)
    logic: Callable by the service role only, never by a signed-in session. The payload holds a title, authors and an optional description as in BR131.1, and exactly one of an owner parent (an active parent the script found in the loaded directory) or a typed owner name of 1 to 200 characters. The row is stored with its source key. A second call with the same key returns the stored result and creates nothing, so a second run makes no duplicate. The book is loaded as available; where a book is now is not migrated. A bad row is refused with a validation envelope that names no cell value, and the next rows are unaffected. A typed owner has no rights, so a super admin records that book's return (BR134.2).
    violation: Validation refusal for a bad row, or denied for any caller but the service role.
    source: FR18.1, contract C17
```

## Summary

| Question | Answer | Rule |
|---|---|---|
| Who reads the library? | Everyone signed in, teachers included, who change nothing | BR130.1 |
| What does the list show? | Title, authors, description if any, owner, state, holder and date | BR130.2 |
| Who adds a book? | Any parent, owner defaults to the adder | BR131.1, BR131.2 |
| Who changes or removes it? | The owner and a super admin; removal only while nobody holds it | BR132.1, BR132.2 |
| Who may borrow? | A parent with a family, not the owner, no limit | BR133.1 |
| Two people at once? | One loan, one refusal | BR133.2 |
| The "until when" date | Optional, only shown, the borrower may change it | BR133.3 |
| Who records the return? | The owner; a super admin if the book has no owner with rights | BR134.1, BR134.2 |
| Being told when it is back | One request per parent, notified once, then ended | BR135.1, BR135.2 |
| Leaving family | One notice per parent per loan from 30 days before changeover | BR136.1, BR136.2 |
| What a book notice holds | The title and a link; no names | BR137.1 |
| On removing a person | Watches deleted, links cleared, held books flagged | BR139.1 |
| The spreadsheet load | Once per row, as available, owner by account or typed name | BR140.1 |
