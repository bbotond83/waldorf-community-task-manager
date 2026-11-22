# Reliability Requirements: u7-swaps-and-duty-changes

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C5, C8, C9, C11 and C16 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Applying a swap is all-or-nothing: the rule check, the exchange, both places back to active, the pick adjustment, the request's status and applied versions and both notices commit together or not at all (BR72.2). A failed email never rolls it back. | A forced failure after the exchange leaves both places and the pick as they were. A failed email leaves the swap applied and the in-app notice in place. |
| NFR7.2 | A reassignment and a reversal are all-or-nothing in the same way, including the cancelled swap and its notices (BR74.4, BR75.3). | A forced failure midway leaves everything as before. |
| NFR7.3 | Approving a cancellation marks the request approved before the place is freed, so the request ends approved and never withdrawn; the rota week is empty with reason `cancelled` and its pick is gone in the same transaction (BR76.2). | A test approves a rota cancellation and reads the request, the place, the week and the pick. |
| NFR7.4 | The database itself refuses a swap row without its target fields, a cancellation row with them, a reason over 500 characters, an approved swap, an applied or reversed cancellation, and applied versions on a request that is not applied or reversed. | A test tries each directly as the database owner. |
| NFR7.5 | Duty start times are compared in Budapest time, including in the weeks where the clocks change, for expiry and for the refusal of started duties (BR73.1, BR73.2, BR74.3). | Tests set the moment just before and after a duty's start in both clock-change weeks. |
| NFR7.6 | The migration applies over a seeded database with existing open and decided requests: open swaps get their stored versions raised to match their pending places, old approved swaps stay as history, and no other row changes. | A test applies the migration over a seeded database and compares rows. |
| NFR7.7 | A failing `dutychanges_swap_expiry_check` is recorded and the other checks still run; a second run the same day ends and sends nothing more (C9). | A forced failure in the check, then two runs. |
| NFR7.8 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once (BR77.4). | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new and retired functions and the new notice kinds. | The scripts name the file and both catalogue tests pass. |
| NFR6.4 | The functions delivered for other units (`place_add`, the C11 change with no family, the expiry check and the removal pair) are tested directly, and U6's existing pick tests pass with the C11 delta. | A database test file calls each as the database owner, and the U6 test files pass unchanged. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The removal preview and apply functions end a removed family's open requests, clear the removed parent from ended ones, return counts only, and return zero counts for a subject with no requests (BR77.3). | A test calls the pair for a parent and for a family and reads the rows; past requests show korábbi tag. |
| NFR11.2 | Swaps of manual duties keep working as before for families of the same group, now under the wider rules; the existing swap tests are updated only where Q1 and Q4 change the outcome. | The existing kernel swap tests pass, with each changed expectation named in the pull request. |
