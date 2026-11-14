# Reliability Requirements: u3-directory-and-profile

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Removing a parent is all-or-nothing: archive, sign-in end, sharing off, details cleared, invitations revoked, pending change cancelled and audit event commit together or not at all (BR36.3). | A forced failure midway leaves the parent unchanged. |
| NFR7.2 | Confirming an email change is all-or-nothing: the sign-in email, account email, email on record and request state change together (BR34.6). | A forced failure leaves all three at the old address. |
| NFR7.3 | Adding a family stores the family, parents and children together, or none (BR35.2). | A forced failure leaves no family row. |
| NFR7.4 | The structure change (new profile table, dropped free-text columns, redefined functions) applies over U1's data without loss of names, families and links; every parent starts unshared. | A test applies the migration over a seeded database and compares row counts and sharing values. |
| NFR7.5 | A failed email send keeps the stored request or invitation and offers a resend, as invitations do today. | A test fails the mailer and finds the stored record and the resend offer. |
| NFR7.6 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. For the read rules and the password change the test plan records why a case has no meaning. | The test plan has one row per rule with every cell naming a test or "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |
| NFR6.4 | Tests that read or write the old profile fields change in the same pull request (list in `functional-spec.md`). | No test mentions the dropped fields. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The lifecycle anonymisation clears the new profile as BR36.3 does, and its erasure test gains cases for the new fields. | Lifecycle tests for a parent and a family. |
| NFR11.2 | Removal's preview and apply steps (C16) count and clear only the directory record, refuse a family's only active parent on the parent path, and leave duties, books and tasks to U14 (BR36.4). | Tests for both subject kinds. |
| NFR11.3 | Deactivating an account sets the parent's sharing off in the same transaction (BR31.5). | A test deactivates and reads the sharing value. |
