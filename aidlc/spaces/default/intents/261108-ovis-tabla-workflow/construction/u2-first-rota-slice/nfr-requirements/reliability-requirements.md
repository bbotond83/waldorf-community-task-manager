# Reliability Requirements: u2-first-rota-slice

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Publishing is all-or-nothing: the duties, places, notices, audit event and the published mark commit together or not at all (BR23.2). | A forced failure midway leaves a draft with no duty, place or notice. |
| NFR7.2 | Making a draft is all-or-nothing: the plan and all its weeks, or none (BR21.1, BR21.2). | A forced failure leaves no plan row. |
| NFR7.3 | A rota duty is unique per origin: one duty per rota week, and one place of capacity 1 (BR26.1). | A test that tries a second duty for one week is refused by the database. |
| NFR7.4 | The structure change (new columns, tables and checks) applies over U1's data without loss, and every existing duty reads as `manual` origin. | A test applies the migration over a seeded database and compares row counts. |
| NFR7.5 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file. A mistaken published plan is reset locally with `db:reset` and `db:seed` until U7 can change duties (functional-design tradeoff).

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | Archiving a family that holds a rota place is refused with DUTY_ROTA_MANAGED until U7 and U14 define what happens (BR25.1); archiving any other family keeps working. U14 extends deletion and anonymisation to every new record. | A lifecycle test archives a family with a rota place (refused) and one without (allowed). |
| NFR11.2 | Today's reminders do not fire for rota duties (BR23.6). Once the notices table allows a notice with no task (see tech-stack-decisions.md), the reminder tick and the task-based lookups ignore such rows. | The existing reminder tests pass on a seed with a published plan. |
