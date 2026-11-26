# Security Requirements: u14-removal-and-anonymisation

Sources: `functional-spec.md` and `rules.md` of this Unit, its design review (R-01 to R-07), NFR1, NFR3, NFR4 and NFR11 in `requirements.md`, contracts C1, C6 and C16 in `contract-summary.md`, `technology-stack.md`, and the owner's answers Q1 and Q2 in `nfr-requirements-questions.md`. Contains no names or contact details.

## Authentication

Sign-in and session rules do not change. What changes is that removal must end every session of every removed parent.

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | The removal command reads the account ids of the subject's parents after the family lock and before any step runs (the directory step clears the link). It returns them in the C1 result, and a repeated click returns the same list (design review R-01). | A database test removes a parent and a family and checks the returned ids against the accounts that were linked. |
| NFR3.2 | After the commit the server ends the sign-in service's sessions of every returned account, and the database's active-session check refuses the next request of each. | An integration test signs in as the parent, removes them in another session, and shows the next request refused, for a parent removal and for a family removal. |
| NFR3.3 | Removing a parent who holds the community's last super admin grant is refused, and the preview shows that refusal so the confirmation page offers no button (R-03). This covers a super admin removing their own family. | Preview and command tests for the last super admin, alone and as a family member. |

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.4 | `parent_remove`, `family_archive`, `removal_preview`, `removal_flagged_items`, `lifecycle_run` and `family_restore` check on the database side that the caller is a super admin of the subject's community (BR200.1). A group admin, a teacher and a parent are refused, also for their own family; a subject of another community answers as not found. | The fixed-list "refused" and "out of reach" tests pass for each function, called directly. |
| NFR3.5 | The eleven step functions and the new WorkingGroups read are granted to no role. Every new or changed function starts with `revoke all`, has an explicit `grant execute` where it is a command or read, and pins its search path. | `tests/database/identity-catalogue.test.ts` lists each function's grants; a call as a signed-in account is refused. |
| NFR3.6 | A right lost while signed in applies at the next request: the removed parents' authorization versions go up in the same transaction. | A test holds a session across the removal and checks the next call. |
| NFR3.7 | `verification/authorization-matrix.json` gains rows for the preview, the flagged-items read and the changed commands for every role. | Evidence in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | From removal on, every read other people use shows a removed parent as "korábbi tag" and a removed family as "korábbi család" (BR204.1). | A test reads each history view of every component after removal and finds no stored name. |
| NFR1.2 | The preview, the report, the flagged-items read and the audit row hold counts, codes, ids, duty and task titles, book titles, dates and group names only: no person's name, contact detail or child's name. | A test asserts the exact fields of each result and of the audit row. |
| NFR1.3 | At removal, the text of the removed person's own entries is emptied: event sign-up notes, food-offer texts, checklist-claim notes, skip reasons they gave on recurring duties, and reasons on their swap and cancellation requests. Texts of shared work (to-do task notes and descriptions, book descriptions, event notices) stay (owner answer Q1, review R-05). | One database test per kind of text: written by the removed person, emptied; written by someone else, kept. |
| NFR1.4 | A parent removed on their own has their stored name replaced by "Anonimizált szülő" in the same transaction (owner answer Q2). A whole family's stored names stay until the later delete or anonymise, so a restore within 30 days still works. | Tests for both: single parent replaced at once, family names kept until the later run. |
| NFR1.5 | The later delete or anonymise leaves no stored name of the family's people: deleted rows are gone, anonymised rows read Anonimizált … | A test runs both outcomes and searches every table for the invented names. |
| NFR1.6 | Seed data, fixtures and tests use invented families and people only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Every removal writes one audit row (`lifecycle.parent_removed` or `lifecycle.family_removed`) with the counts per step, and the later run writes `lifecycle.delete` or `lifecycle.anonymize` with its counts, in the same transaction; a failed audit write rolls the change back (BR201.3). | A test makes the audit write fail and finds the subject unchanged. |
| NFR4.2 | Audit rows are never rewritten; their actor ids stay as they are after the account is gone (C16). | A test reads the earlier rows of the removed account after removal and finds them unchanged. |

## Threat Considerations

- **Wrong person removed.** Confirmation pages name the parent or family and show the counts first; removal takes the version the page showed, so a page for a changed record is refused.
- **Partial removal leaving data behind.** One transaction for all steps; any failure rolls everything back (BR201.1).
- **Session surviving removal.** Covered by NFR3.1 and NFR3.2.
- **Names leaking through free text.** Covered by NFR1.3; shared texts that stay are visible only to people who could already read them.
