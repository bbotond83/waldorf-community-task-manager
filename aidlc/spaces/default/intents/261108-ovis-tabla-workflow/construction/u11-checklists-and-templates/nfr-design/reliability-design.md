# Reliability Design: u11-checklists-and-templates

How the targets in `reliability-requirements.md` are met, following `functional-spec.md` and C8, C9, C15 and C16 in `contract-summary.md`. Nothing is hosted, so only data integrity and testing apply.

## Transactions

| Requirement | Design |
|---|---|
| NFR7.8 | `template_save` runs in one transaction: template row, replaced sections and tasks, audit entry. |
| NFR7.9 | `checklist_copy_template` creates the head, sections and tasks in one transaction. The event itself was saved by U10 in an earlier call, so a failed copy leaves the event with no section, and the guard (no section yet) lets the copy run again. |
| NFR7.10 | The copy keeps no reference to template sections or tasks, only `copiedFromTemplateId` on the head, so template commands cannot reach an event. |
| NFR7.14 | The replacement `event_save_core` is U10's latest function with one change: the recipient union of the cancellation and change notice gains `unnest(checklist_claimant_ids(v_id))`. U10's event tests run unchanged. |
| NFR11.3 | The removal pair runs in U14's transaction. Apply deletes the subject's claims on tasks not done in events not finished, clears `parent_id` and `family_id` on the other claims, and clears `done_by_parent_id` on tasks they marked. |

## Database rules

| Requirement | Design |
|---|---|
| NFR7.11 | Check constraints: a claim holds exactly one of parent and typed name, or neither only when its typed name is empty and both links were cleared by removal; `chosen_at` is null when the task's time does not matter (checked in the functions, since it needs the task). Unique: `(task_id, parent_id)` where `parent_id` is set; `(event_id, source_ref)` where set; positions per parent, deferrable. A deferred constraint trigger refuses more claims than `helpers_needed` and any claim or done mark on a teachers' section; a foreign key on `(section_id, event_id)` keeps a task in its own event's section. |
| NFR7.13 | Dates are compared as Budapest dates inside the functions (`at time zone 'Europe/Budapest'`), as in U10. |
| NFR7.15 | The install skips a template whose name the community already has, so a second run adds nothing. |
| NFR7.16 | All changes go through `npm run verify:local` and the `Validate` check. |

## Daily checks

| Requirement | Design |
|---|---|
| NFR7.12 | Each check loops over the due events; each event runs in its own `begin ... exception` block, so an error rolls back only that event, is added to the run's detail, and the loop goes on. The once keys stop a second send. |
| NFR7.17 | `timed_checks_run_system` runs in one transaction, and `notice_send` writes the notice, its once key and the queued email inside it. A run that stops partway commits nothing at all, so no notice or once key of that run is kept; the second run sends each due notice once. The test forces an error after this Unit's first due event, raised outside the per-event exception block so the run itself fails, then checks that nothing was kept and re-runs. |

## Testing

| Requirement | Design |
|---|---|
| NFR6.5 | Application code (read models, facade, screens) is covered by Vitest to the existing 80% floor. |
| NFR6.6 | Each rule gets a test file under `tests/database/` with the fixed list, and the plan table shows each cell. |
| NFR6.7 | New files are named in their `test:database:*` script and the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. |
| NFR6.8 | One test file calls `checklist_add_task` (with a parent, a typed name, an inactive parent and none), `checklist_claimant_ids`, `template_list(group_id)` and the removal pair as the database owner. |
| NFR11.4 | The existing task, sign-up, swap and cancel tests run unchanged, `src/data/admin-port.test.ts` included. New database tests refuse a new task with an event and an unlinked task given one, and allow an old linked task saved with its event unchanged and with its link removed. |
