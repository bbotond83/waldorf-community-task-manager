# Reliability Requirements: u9-recurring-duties

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9 and C16 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | Saving a schedule, with the removal of its later unnoticed occurrences, the creation of today's occurrences and the audit entry, commits together or not at all (BR144.1). | A forced failure midway leaves the schedule and occurrences as before. |
| NFR7.2 | Switching a schedule off and skipping its later occurrences are written in one step (BR144.2). | A forced failure between the two leaves neither. |
| NFR7.3 | The database itself refuses: two occurrences for one schedule and due date; a schedule with no owner or two owners, or an owner that does not match its kind; a season with only one month, or from after to; an interval outside 1 to 52; `rota_weeks` on a non-rota owner; a done occurrence without a person and time, or an open one with them; a skipped occurrence without a reason. | A test tries each directly as the database owner. |
| NFR7.4 | Notice catch-up: the daily check sends the due notice for every open occurrence whose due date is today or earlier and has no due notice yet, within 3 days of the due date, and sends the overdue notice for every open occurrence 3 or more days past due with none yet; each at most once through its once key. So a schedule saved after that day's run, a missed run and an exact-day boundary all still lead to one notice and none to a duplicate. This closes the notice-timing gap named in the design review. | Tests: save after the run, skip a day of runs, and run on day 2, 3 and 4 after the due date; one notice each. |
| NFR7.5 | A failing daily check is recorded in U5's run record and does not stop the other checks; a failed email does not fail the check (C9, C8). | A test forces each failure and reads the run record and the occurrences. |
| NFR7.6 | Due dates, seasons, the 14-day lead, the 3-day overdue notice, the 24-hour undo window and the 60-day history limit are all computed in Budapest time, including in the weeks where the clocks change. | Tests set moments just before and after each boundary in both clock-change weeks. |
| NFR7.7 | Rota-week counting is stable at the edges: the first water week of the year, a republished rota, and the turn of the school year give one clear numbering, so no occurrence is created twice or skipped by a republish (BR143.2). | Tests republish a plan and run the check across a year boundary. |
| NFR7.8 | Removal flags rather than deletes: the removal pair reports the same counts in preview and apply, writes nothing for a family, and for a parent clears only the done and skip person (BR151.1). The entity rule "done has a person" is relaxed only for this cleared case, and the screens show "korábbi tag". | A test removes a parent and a family and reads the rows. |
| NFR7.9 | The structure change adds new tables and registry rows only; no existing table, duty or notice row changes. The seed gains the starting list. | A test applies the migration over a seeded database and compares existing row counts. |
| NFR7.10 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables, notice kinds and the registered check. | The scripts name the file and both catalogue tests pass. |
| NFR6.4 | The functions delivered for other units are tested directly: `recurring_list`, `recurring_my_occurrences`, `recurring_bottle_for_duty`, `recurring_due_check`, `recurring_notice_facts` and the removal pair. | A database test file calls each as the role it is granted to. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | The removal preview and apply functions report a family's schedules and open occurrences, clear a removed parent's done and skip person, keep the rows, and return zero counts for a subject kind they do not hold (BR151.1). | A test calls the pair for a parent and for a family, and reads the rows afterwards. |
| NFR11.2 | Existing rota, swap, duty card and notice behaviour is unchanged: a swap writes no row of this Unit and the cleaning duty follows the water week by the live read (BR147.2). | The existing swap and rota tests pass on the new structure. |
