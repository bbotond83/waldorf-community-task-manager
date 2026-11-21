# Reliability Requirements: u10-events-and-signups

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8 and C16 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Saving an event with its notices is all-or-nothing: the event, its notice list, the audit event and the change notice commit together or not at all (BR103.2, BR117.1). A refusal by the notification function rolls it back; a failed email does not. | A forced failure midway leaves the event as before. A failed email leaves the event saved and the in-app notice in place. |
| NFR7.2 | Cancelling an event and closing its open tasks are written in one step (BR118.1). | A forced failure between the two leaves neither. |
| NFR7.3 | The database itself refuses a role holding both a parent and a typed name, an organiser mark without a parent, a gap or repeat in notice positions, an eleventh notice, a twenty-first role, a new offer on an event with food sign-up off (offers already made stay editable and withdrawable, BR102.1, BR116.1), and an end before the start. | A test tries each directly as the database owner. |
| NFR7.4 | A role may hold neither person only after a removal, and then shows korábbi tag (BR105.1, BR124). | A test removes a parent and reads the cleared role. |
| NFR7.5 | The structure change applies over a seeded database: existing events keep their title, dates, place, status and group, and their tasks and places are untouched. The three fixed notes and the coordinator name are dropped without migration (invented test data, local reset). | A test applies the migration over a seeded database with events and tasks and compares event, task and place row counts and the kept fields. |
| NFR7.6 | The deadline and the event dates are compared in Budapest time, including in the weeks where the clocks change. | Tests set the moment just before and after the end of an event in both clock-change weeks. |
| NFR7.7 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions and notice kinds. | The scripts name the file and both catalogue tests pass. |
| NFR6.4 | The functions delivered for later units are tested directly, because no screen of this Unit calls `event_is_summer`, `event_deadline`, `event_organisers` or the removal pair. | A database test file calls each as the database owner. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The removal preview and apply functions report and clear a person's sign-ups, offers and roles, keep the rows, and return zero counts for a subject kind they do not hold (BR124.1). | A test calls the pair for a parent and for a family, and reads the rows afterwards. |
| NFR11.2 | Today's event tasks, their places, notes and swaps keep working unchanged (Q6, BR121.1). | The existing event-task tests pass on the converted structure. |
