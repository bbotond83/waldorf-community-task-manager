# Reliability Requirements: u6-full-rotas-and-weekend-picks

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9 and C16 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Publishing is all-or-nothing for the whole plan: the weekly duties, the weekend slots and their duties, all places, the audit event and the published mark commit together or not at all (BR62.4). A refusal by the notification function rolls it back; a failed email does not (BR62.5). | A forced failure midway leaves a draft with no duty, slot, place or notice. A failed email leaves the plan published and the in-app notice in place. |
| NFR7.2 | A pick and the place of its slot are written in one step and always agree (BR63.9). | A forced failure between the two leaves neither; after every pick test an invariant query finds no pick without its place and no picked place without its pick. |
| NFR7.3 | The database itself refuses a second pick for a picking week, a second pick of one slot, a sixth slot for a weekend, a second standing row for a family and year, and a second duty for one slot. | A test tries each directly as the database owner. |
| NFR7.4 | The structure change applies over the data of U1 to U5 without loss: existing plans get the three new rotas as `not_drafted` rows (BR62.6), existing duties keep their origin, and existing notices stay readable. | A test applies the migration over a seeded database holding a draft and a published plan, and compares row counts. |
| NFR7.5 | Every time rule is computed in Budapest time, including in the weeks where the clocks change: Wednesday 00:00, Friday 12:00 and Saturday 00:00 mean local time. | Tests set the moment of the run and of a pick just before and after each boundary, in a normal week and in both clock-change weeks. |
| NFR7.6 | A check that fails is recorded and the other checks still run; a run made late sends what is still due and not yet sent (BR64.5). | A test forces one check to fail, and another runs a check one day late. |
| NFR7.7 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file. A mistaken published plan is reset locally with `db:reset` and `db:seed` until U7 can change duties.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |
| NFR6.4 | The draft is checked as a whole over several family counts (1, 2, 3, 20 and 30), break patterns, years and mixes of leaving and new families: one family per duty week, full-year families within one week of each other per rota, no indoor cleaning and front garden in one week, nobody on the wrong side of the changeover date, and the same input giving the same draft (BR61.1 to BR61.6). | A database test runs the grid and asserts each property. |
| NFR6.5 | The functions delivered for later units are tested directly, because no screen of this Unit calls `rota_check_change`, `rota_adjust_picks_after_change`, `rota_family_for`, the standing reads or the removal pair. | A database test file calls each as the database owner. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The removal preview and apply functions of this Unit report a family's future rota weeks and picks and change nothing (BR66.4). Archiving a family that holds a rota or weekend place stays refused with DUTY_ROTA_MANAGED until U7 and U14 define what happens. | A test calls the pair, and a lifecycle test archives a family with a weekend place (refused) and one without (allowed). |
| NFR11.2 | Today's duty reminders (one week and one day before) still do not fire for rota and weekend duties; this Unit's own reminders replace them (BR64.1, BR64.4). | The existing reminder tests pass on a seed with a published four-rota plan, and no rota duty gets a reminder job. |
