# Reliability Requirements: u1-community-foundation

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## The Structure Change

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | The structure change is all-or-nothing (BR1.4). | A forced failure leaves the old structure and data unchanged. |
| NFR7.2 | Afterwards no import function or table remains, and no account holds an old-style grant (BR1.4, BR7.1). | Catalogue test. |
| NFR7.3 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file. Locally, `db:reset` and `db:seed` rebuild a known state.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan's table has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason (BR6.2). |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | Today's removal of a family keeps working and also ends the memberships of its parents. U14 extends it to every new record. | The lifecycle tests pass on the new structure. |
