# Security Design: u13-lending-library

Sources: `security-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` and `rules.md` (BR130 to BR140) of this Unit, and C1, C2, C6, C8, C16 and C17 in `contract-summary.md`. Contains no names or contact details.

## Defence in Depth

| Layer | Control |
|---|---|
| Database role | Signed-in accounts keep read-only rights; every command is a named function that starts with `revoke all` and an explicit `grant execute`, and pins its search path. The three new tables hold no direct right for a signed-in account (NFR3.7). |
| Function check | Each function checks the caller itself with the existing helpers (active session, role, current family, reach), so a direct call gets the same answer as a screen (NFR3.1, NFR3.2). |
| Row-level security | Book reads go through `library_book_list` and `library_book_get` only; the loan and watch tables have no read for a signed-in user, so the loan history cannot be read (NFR1.4). |
| Application layer | `authorization.ts`, `role-policy.ts` and navigation gain the library entries; they translate and present and never decide alone. `verification/authorization-matrix.json` gains the library rows, and each new screen is walked through for every role (parent, group admin, super admin, teacher, signed out) with the result recorded in the Unit's test results before merge (NFR3.9). |

## Authorization Design

| Command | Who is allowed | Everyone else |
|---|---|---|
| Read list, read book | Any signed-in reader, a teacher included (BR130.1) | Signed out is sent to sign-in |
| Add book | Active parent, group admin or super admin; no family needed (BR131.1) | Denied (teacher, signed out) |
| Change, remove book | The owner with rights; a super admin (audited when not the owner) | Denied |
| Borrow | Parent with a family, not the owner | Denied or refused on `own_book` |
| Set until date | Borrower of the open loan only | Denied, same answer for a real and a made-up loan |
| Record return | The owner with rights; a super admin only when no owner has rights | Denied |
| Watch add, remove | An active parent, group admin or super admin, for their own watch only (BR135.1) | Denied (teacher, signed out, another person's watch) |
| `library_due_check`, removal pair | Service role / database owner only | No signed-in role can run them |
| `migration_load_book` | Service role only | Refused for any signed-in account |

- **Same answer for real and made-up ids (NFR3.5).** The loan and watch functions look the row up and test the caller in one condition, and return the one denied refusal for "not yours" and "does not exist" alike, so a parent cannot probe for other families' loans.
- **Rights lost while signed in (NFR3.8).** Nothing about rights is cached in the session; each function re-reads the account's role and the book's owner link, so the next command after a change is refused.
- **Super admin path.** The extra right is checked against the book's owner state inside the function (BR134.2), and the audit entry is written in the same transaction (see below).

## Data Protection Design

- **Display names only (NFR1.2).** The read functions build their JSON from an explicit field list: title, authors, description, availability, holder display name and since-date, owner display name or typed name, version, and the caller's watch flag. No contact detail, child's name or sharing choice is selected. A typed owner name is shown as typed, with no link.
- **Plain text (NFR1.3).** Text fields are plain text with database length checks (200, 200, 1000) and are escaped by React on output; no markup, link or HTML rendering path exists.
- **Notices (NFR10.1).** `book_returned` and `book_return_due` are rendered from the book's title and, for the reminder, the changeover date, through the registered notice kinds. The only source of that text is the book facts function `book_notice_facts`, which U5's registry requires for the notice target `book` and calls at send time. It takes the book id (and, for the reminder, the loan id), returns the title, the link `/szulo/konyvtar/[id]` and, for `book_return_due`, the changeover date, and selects no holder, owner, watcher or contact column. It reads a removed book too (the notice is still delivered and the link answers as an unknown book, BR137.1), works for the service role that the daily run uses, and returns nothing for an unknown id. A test reads its output for each kind, for a removed book, and for an unknown id.
- **Test data (NFR1.1).** The seed, fixtures and tests use invented names; every address or number in a test is added to `scripts/verification/privacy-allowlist.json`.

## Audit Design (NFR4.1)

A super admin's return, change or removal of a book they do not own, a super admin's change of owner, and a removal applied write one audit entry in the same transaction as the change, with opaque ids and the actor, and no title, author, name or description. If the entry cannot be written the function raises and the whole change rolls back. The rollback is tested by adding a temporary trigger on the audit table that raises, inside the test only, and checking the book is unchanged. Repeated clicks write no second entry because the once key returns the stored result before anything runs (NFR4.2). Denied attempts use the existing denied-audit path and rate limit (NFR4.3).

## Migration Load (C17)

`migration_load_book` returns only an outcome code and the row's position in the batch, never a cell value, so a failed row cannot leak a name from the real workbook into a log. It writes no per-book audit entry: the one-off script prints counts per outcome and nothing else, and an owner-run trial is the check. This is the design choice for the open point of who audits the load; it keeps the real data out of every record.

## Threat Controls

Each threat in `security-requirements.md` is covered by the control listed there, realised as above: caller check inside the function (NFR3.2, NFR3.3), lock plus open-loan refusal (NFR5.2), display names only (NFR1.2), escaped plain text (NFR1.3), texts from the book's facts only (NFR10.1), service-role-only grants (NFR3.6), and pinned search paths (NFR3.7).
