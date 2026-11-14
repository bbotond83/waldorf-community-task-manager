# Scalability Requirements: u3-directory-and-profile

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families, so roughly 40 parents and 40 children. The directory is one call returning at most one card per family, far below the data API's limit of 1000 rows. Email changes and invitations are a few a month. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | A repeated click on any new command (sharing, own details, add, edit, remove, invite) returns the stored result and creates no duplicate (BR31.3, BR32.3, BR36.1). | Fixed-list "repeated click" test. |
| NFR5.2 | A save over an outdated version is refused with VERSION_CONFLICT for sharing, own details and removal. | Fixed-list "outdated screen" tests. |
| NFR5.3 | Two requests for an email change at once leave exactly one pending request; two confirmations of the same link change the email once (W5). | Two-at-once tests count requests and email changes. |
| NFR5.4 | Two administrators adding parents with the same email at once give one success and one EMAIL_UNAVAILABLE. | A two-at-once test. |
| NFR5.5 | A parent saving details while being removed gets VERSION_CONFLICT or the denied refusal, never a stored value on a removed parent. | A two-at-once test. |
| NFR5.6 | Removal locks the family row first, then the parent rows ascending, as C1 and C16 require; no deadlock appears in repeated runs. | The race tests pass repeatedly. |

The read rules (BR30) have no "outdated screen" or "repeated click" cases; the test plan records why.
