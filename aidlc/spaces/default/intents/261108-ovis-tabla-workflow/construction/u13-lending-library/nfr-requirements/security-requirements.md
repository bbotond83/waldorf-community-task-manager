# Security Requirements: u13-lending-library

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C8, C16 and C17 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no book, loan or watch data and is sent to sign-in. The only new service-role entry point is `migration_load_book`, which is callable by the service role and never by a signed-in session (BR140.1).

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side, as its rule says (BR130 to BR140). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Changing and removing a book are refused for everyone except the owner with rights and a super admin, including by calling the function directly. A refused read is a denied refusal, never an empty list. | The fixed-list "out of reach" test passes for each function. |
| NFR3.3 | Recording a return is refused for the borrower, another parent, a coordinator and a teacher, and for a super admin unless the book has no owner with rights (BR134.1, BR134.2). | A test calls the function as each role on a book with and without an owner with rights. |
| NFR3.4 | A teacher reads the library as every signed-in reader does (BR130.1), and every command is refused with the denied code. | Reach tests for a teacher on every read (allowed) and every command (refused). |
| NFR3.5 | Only the borrower of an open loan can set its date (BR133.3), and a parent can remove only their own return watch (BR135.1); a parent of another family gets the same denied refusal for a real row and a made-up one. | A test compares both refusals. |
| NFR3.6 | `library_due_check` and the removal pair cannot be executed by any signed-in role, and `migration_load_book` only by the service role. | The catalogue test lists their grants, and a call as a signed-in account is refused. |
| NFR3.7 | Signed-in accounts keep read-only table rights. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. The new tables hold no direct right for a signed-in account. | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.8 | A right lost while signed in applies at the next request: a removed parent, or an owner who is no longer the owner, is refused on the next command. | A test changes the right between two requests. |
| NFR3.9 | `verification/authorization-matrix.json` gains rows for the library commands for every role, and each new screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families, people and books only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The library reads return display names only: no contact detail, no child's name, no sharing choice. A typed owner name is shown as typed and carries no link or profile (BR130.2). | A test asserts the exact fields each read returns. |
| NFR1.3 | A book's title, authors and description are plain text, shown escaped, with their length limits enforced in the database (200, 200 and 1000 characters). | A test saves markup and reads it back unchanged and escaped on the page. |
| NFR1.4 | The loan history is never read by a screen or function beyond the open loan; closed loans carry no read for a signed-in user. | A catalogue test lists the reads and their columns. |
| NFR10.1 | Every notice and email of this Unit names the book and, for the reminder, the changeover date, and nothing else: no holder, owner, other watcher, phone number, email address or child's name (NFR10, BR137.1). | A test reads each kind's text from the local test mailbox. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | A super admin's return, change or removal of a book they do not own, a super admin's change of owner and a removal apply each write one audit entry with opaque ids and the actor, and no title, author, name or description; the change rolls back when the entry cannot be written (BR139.2). | A test reads the book after each command and the audit entry for each, and a forced audit failure (a temporary failing trigger on the audit table, inside the test only) leaves the book unchanged. |
| NFR4.2 | A repeated click writes no second book, loan or watch. | The "repeated click" test counts rows. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent records a return, or removes or edits a book, by calling the function directly | The caller is checked inside the function (NFR3.2, NFR3.3) |
| A parent borrows a book that someone else just borrowed | The book row is locked and an open loan is refused (BR133.2) |
| A parent learns another family's contact details through a book | The reads return display names only (NFR1.2) |
| A title or description injects markup | Plain text, escaped on output (NFR1.3) |
| A notice leaks a holder or contact detail | Texts come from the book's facts function only (NFR10.1) |
| A signed-in user calls the daily check or the load | Grants are service role only (NFR3.6) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.7) |
