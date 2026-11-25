## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T17:25:31Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR182.1, BR183.2, BR189.1, BR190.1 | Claim and mark-done check the caller is still an active parent before the task row is locked, and no to-do command locks a family row. A removal (U14 holds the family row, then clears claims) can commit between that check and the lock. The waiting claim or done mark then succeeds for the removed person, leaving a claim that was never cleared or flagged. The removal block cannot see it, because it already ran. | State in BR182.1 and BR183.2 that the caller's active-parent check is repeated after the task row is locked, and refused if the parent is gone. Add a "two people at once" test of a claim racing a removal. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR180.2 trigger, BR190.1; functional-spec.md > Commands and reads table, Conversion of Existing Code | Three functions are referred to but never defined. `todo_task_set_attention` appears in BR180.2 and is not in the commands table or any rule. No read exposes the flagged tasks, so U14's "Teendő a távozás miatt" list (named in BR190.1) has nothing to call, since C16 returns counts only. The group detail page uses a "sibling read" of `todo_list_for_group` that has no name, caller block or rule. A developer would have to invent all three. | Either delete `todo_task_set_attention` or define it. Add a read for flagged tasks (callable by super admins, with its fields and test list) and say whether `todo_list` and `todo_get` return `needsAttention`. Name the community-reader read for the group page and give it a rule. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR182.2, BR182.1, BR185.1 | "Version goes up" is stated only for save, update, mark done and undo. Claim, give back and free do not say it. The pull's conflict check (BR185.1) reads the claimant before the to-do rows are locked and relies on the version to catch a claim change, so a claim that does not raise the version would be carried to the wrong person unnoticed. The order of checks is also unclear when a stale screen hits an already claimed task: the spec shows "Ezt a teendőt már elvállalták" (TODO_CLAIMED), while the rule lists VERSION_CONFLICT too. | State that every command that changes a task raises the version, including claim, give back and free. State which refusal wins for claim when both apply (the spec suggests TODO_CLAIMED). | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR185.1 and entities.md > TodoEventLink | The link is unique on taskId and eventId, and a repeat pull returns the existing link. If the checklist task was later deleted ("Már nincs az esemény feladatlistáján"), the task can never be pulled into that event again. A pull that repeats an already linked task with an old version is not settled either: conflict or "existing link". | Say that a link whose checklist task no longer exists is replaced on a new pull. Say that an already linked task skips the version check. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR188.2 | The once key is task id plus deadline date. If the claim passes to someone else after the reminder went out, the new claimant never gets one. | Add the claimant to the once key. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/rules.md > BR188.1, BR185.1 | "When the edit leaves the claimant's task changed" does not say which edits notify, so a typo fix in the note could notify. Pulling a claimed task into an event also makes the claimant first helper on the checklist, and neither this unit nor the spec says they hear of it. | List the fields that trigger `todo_changed`. Decide whether the pull notifies the claimant, or record that it deliberately does not. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u12-todo-and-my-tasks/functional-design/entities.md > TodoTask ownerKind family | After U14 removes a family, a family-owned task still references it. How the owner shows on the list and what a super admin can do with the flagged task are not stated. | Say how the owner of a task whose family was removed is shown and whether the task can be reassigned. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| None listed for this stage | Not run | The review was by reading. The cross-checks against C1 (lock steps), C14, C15, C16 and C17 are in the findings. |

### Summary

The design covers the acceptance criteria and requirements the unit owns (AC2.4.x, AC14.x, AC15.x, AC17.1.1, AC17.1.6) and is coherent with the contracts. The pull's lock order (event, checklist rows, then to-do rows ascending) fits the C1 steps, with no cycle against checklist or removal paths. The two Major points to settle before approving are the claim-versus-removal race and the three undefined functions, including the flagged-task read U14 needs. The rest are Minor.
