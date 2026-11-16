# Scalability Requirements: u4-working-groups

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 and C16 in `contract-summary.md`. The stack's limits are in `technology-stack.md`.

## Load Projection

The app serves one community of about 20 families, so roughly 40 parents, and six working groups. A group page returns at most about 40 member rows, far below the data API's limit of 1000 rows. Memberships change a few times a school year, and coordinators change mostly at the start of the year. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.8 | A repeated click on join, leave, appoint or revoke returns the stored result. It creates no second membership, grant, notice or audit event (BR40.3). | Fixed-list "repeated click" test for each command. |
| NFR5.9 | Two joins by the same parent at once, with different keys, end with one active membership. The second join answers ALREADY_MEMBER, also when it hits the one-active-membership index rather than the check (BR40.3). | A two-at-once test counts memberships and reads both results. |
| NFR5.10 | Leave, appoint and revoke sent over an outdated version are refused with VERSION_CONFLICT (BR40.4, BR41.3, BR41.5). | Fixed-list "outdated screen" tests. |
| NFR5.11 | Every row of the concurrency table in `functional-spec.md` gives the outcome it names. These are appoint against leave, two appoints, revoke against leave, two revokes, and join against removal. | One two-at-once test per row. |
| NFR5.12 | Join locks the family row, then the parent row, for share. Removal locks the family, the accounts and the parents, and then the memberships in ascending id order. Repeated runs of join against removal show no deadlock. | The join-against-removal race test runs 50 times in a row in one test run without a deadlock error, and passes in the shuffled run. |

The read rules (BR42.x, BR43.1) have no "outdated screen" or "repeated click" cases. The test plan records why.
