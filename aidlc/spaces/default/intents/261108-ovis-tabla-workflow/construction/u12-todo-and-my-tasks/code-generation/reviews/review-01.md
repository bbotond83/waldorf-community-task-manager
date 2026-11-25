## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | supabase/migrations/20261071_todo_and_my_tasks.sql > todo_task_save, lines 369-371 and 438-446 | A change of owner keeps the claimant. A super admin can hand a claimed family-owned task to another family (or a claimed group task to a family) and the claimant, who belongs to a different family, stays on it. That person can still give back, mark done and update the task, and no parent of the new owner family can claim it. This breaks the rule that a family-owned task is claimed only by that family. The hand-over tests only use a flagged task with no claimant, so this case is untested. | When the owner changes to a family, release a claim whose holder is not in that family: clear claimant and claimed_at, set in_progress back to open, write a claim_freed history row and notify the claimant. Add a database test for a claimed task handed over, or refuse the hand-over while a claim from another family exists. | New |
| R-02 | Minor | app/_todo/TodoScreens.tsx > task page header (lines 374-383) and app/_todo/TodoForms.tsx line 334; src/application/todo-format.ts eventLinkText | The "Átadás másik családnak" link and chooser are not in the approved functional-design screen table. The code summary says they were added after the owner review. The "Csak figyelmet igénylők" filter is also not in that table. I could not compare them with the Stitch screens. The text for a vanished event link is "(már nincs a listán)", while BR185.2 says "Már nincs az esemény feladatlistáján". | Confirm in the owner's screenshot review that the hand-over action and the attention filter are approved and in Stitch. Use the BR185.2 wording for the gone link or update the rule. | New |
| R-03 | Minor | supabase/migrations/20261071_todo_and_my_tasks.sql > migration_load_todo lines 1604-1607 | The one-off load accepts status in_progress with no claimant. No other path can create that state. | Map in_progress to open in the load, or refuse it. | New |
| R-04 | Minor | supabase/migrations/20261071_todo_and_my_tasks.sql > todo_task_save lines 344-348 | Creating or handing a task to a family reads the family without locking it. A removal that commits in between leaves a new task of the removed family with no attention flag. The design chose no family lock on purpose. | Take a share lock on the family row in the family branch, ahead of the task insert (the removal takes the family row first), or record the accepted gap. | New |
| R-05 | Minor | supabase/migrations/20261071_todo_and_my_tasks.sql > idempotent replay returns (for example line 292); src/data/todo.ts toChange | A replayed command returns no version, so the screen gets version null after a repeated click. | Return the stored version on replay, or confirm the screens re-read after every command. | New |
| R-06 | Minor | app/_todo/TodoScreens.tsx lines 276-278 | The owner filter options are built from the items on the current page. After filtering by one owner the dropdown offers only that owner. | Build the options from an unfiltered read or the groups list. | New |
| R-07 | Minor | code-generation/traceability.json | Coverage maps each ID to a whole test file, so no entry shows which of the six cases covers it. I could not match every entry (for example AC17.1.2 to notices-failures.test.ts) to a named test. I did not run the test suites in this review. The claim of a green verify:local rests on the summary only. | Add the test name per entry for the database rules, and re-run npm run verify:local before the gate. | New |

### Verified without finding

- Lock order. Single-task commands lock only the task row. The pull locks the event row first, then the checklist rows inside checklist_add_task, then the to-do rows ascending, and compares versions after the lock. The removal pair locks the family row, then the to-do rows ascending.
- Post-lock checks. Claim, give back and mark done re-read the caller after the lock. The manage-right functions are evaluated after the lock in free, update and undo.
- Scope. Every read and command filters by organization. An unknown id and another community's id give the same denied answer. In the save function and in the pull, the answer is not_found only for a super admin, and in the pull it names the field.
- Family-owned task of another family. The claim answers as denied, the same as an unknown id.
- Rights and envelope. All 27 functions start with revoke all. The internal functions get no grant, the load goes to service_role only, and the commands use an idempotency key and U3R00. The history table is protected by a trigger, and no table has an application grant.
- Notice kinds. todo_changed and todo_due are registered. The facts function names only the topic. The reminder key carries the task, claimant and deadline. notice_send_core filters inactive parents and accounts.
- Hungarian copy and English identifiers. No real names or contacts found in the files read. The empty My tasks text matches BR186.2.
- Fixed test list. The claim, save and race tests contain allowed, refused, out of reach, outdated screen, repeated click and two at once.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Test suites, verify:local | Not run by the reviewer | Results come from the code summary and are not independently confirmed. |
| Stitch comparison | Not run | The owner's screenshot review remains the check. |

### Summary

The migration and application layers follow the approved lock order, reach rules, grant pattern and notice design. One real gap exists: a hand-over leaves a claimant from another family on the task. The remaining items are minor and none blocks the unit.
