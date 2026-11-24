# Reliability Requirements: u11-checklists-and-templates

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9, C15 and C16 in `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.8 | Saving a template is all-or-nothing: the template, all its sections and tasks, and the audit entry commit together or not at all (BR160.3). | A forced failure midway leaves the template as before. |
| NFR7.9 | Copying a template is all-or-nothing: the checklist head, every section and every task appear together or none do. A failed copy leaves the event saved with an empty checklist that can be filled again (BR163.2). | A forced failure midway leaves no section; a second copy then succeeds. |
| NFR7.10 | A later template change or removal changes no copied event (BR163.3). | A test copies, edits and removes the template, and compares the event's checklist before and after. |
| NFR7.11 | The database itself refuses more claims than helpersNeeded, two claims by one parent on one task, a claim with both or neither of a parent and a typed name (except after removal), a claim or done mark on a teachers' task, a gap or repeat in positions, a task whose section belongs to another event, and a duplicate sourceRef on one event. | A test tries each directly as the database owner. |
| NFR7.12 | The daily checks are safe to run twice on the same day and send each notice at most once (once keys of BR168.1 and BR168.2); an error on one event is noted in the run's detail and the others still run (BR168.3). | A test runs the run twice and counts notices, and forces an error on one event. |
| NFR7.17 | A daily run that stops partway (for example the process is killed) can be started again the same day. The run is one transaction, so a stopped run leaves no notice, once key or queued email behind, and the second run sends each due notice once. | A test makes the run fail after this Unit's first due event has been handled (a forced error raised outside the per-event handling), checks that no notice or once key of that run was kept, runs it again, and counts each event's notices. |
| NFR7.13 | Dates are compared in Budapest time: the lead-time day, the three days before the deadline, an event's start and end, including in the weeks where the clocks change. | Tests set the moment just before and after each boundary in both clock-change weeks. |
| NFR7.14 | The changed `event_save_core` keeps every U10 behaviour and adds only the checklist helpers to the cancellation and change notice (BR170.6). | U10's event tests pass unchanged, and a new test cancels an event with a helper and reads the helper's notice. |
| NFR7.15 | The starting-template install adds the ten templates once; running it again adds nothing (BR162.1). | A test runs it twice and counts templates, sections and tasks. |
| NFR7.16 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.5 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.6 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once. | The test plan has one row per rule with every cell naming a test or saying "nem értelmezhető" with its reason. |
| NFR6.7 | Each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables and notice kinds. | The scripts name the file and both catalogue tests pass. |
| NFR6.8 | The functions delivered for other units are tested directly, because no screen of this Unit calls `checklist_add_task` (with and without a claimant), `checklist_claimant_ids`, `template_list(group_id)` or the removal pair. | A database test file calls each as the database owner. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.3 | The removal preview and apply functions free a person's open claims, keep and anonymise their other claims and done marks, and return zero counts for a subject that holds nothing (BR170.4). | A test calls the pair for a parent and for a family, and reads the rows afterwards. |
| NFR11.4 | Tasks with no event, and the rows already linked to an event before this change, keep working; only a new event link is refused (BR169.1). The task screen's edit, which sends the stored event id back, keeps working unchanged. | The existing task, sign-up, swap and cancel tests, including `src/data/admin-port.test.ts`, pass unchanged; a database test edits a task linked before the change. |
