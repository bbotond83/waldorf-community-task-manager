# Business Rules: u12-todo-and-my-tasks

Built from `unit-of-work.md` (U12), `unit-of-work-story-map.md`, `stories.md` (US2.4, US14.1 to US14.3, US15.1, US17.1), `requirements.md` (FR1.2, FR1.3, FR2.3, FR14, FR15, FR17.3, FR17.4, FR18.1, NFR3 to NFR6, NFR10, NFR11), `components.md`, `contract-summary.md` (C1, C2, C6, C8, C9, C14 to C17) and `functional-design-questions.md` (Q1 to Q6). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about scope and reach, U9's rules (BR150 and following) and U11's rules (BR160 to BR170) still hold unless a rule here says it replaces one. Contains no names or contact details.

All dates and times are Budapest time. A *manager* of a task is a super admin, or, for a task owned by a working group, a coordinator of that group (`can_manage_group`, C2). The *claimant* is the parent in `claimedByParentId`.

## Rules

```yaml
rules:
  # --- Reading and managing the list --------------------------------------------------------------
  - id: BR180.1
    statement: Every signed-in reader of the community sees the whole to-do list; teachers read it and change nothing.
    category: authorization
    applies_to: [TodoTask, TodoTaskHistory, TodoEventLink]
    trigger: todo_list, todo_get
    logic: A caller with an active session in the community, a parent or a teacher or a super admin, reads every task of the community, including family-owned ones, because the list belongs to the whole community (FR1.2, FR14.5). The read returns the task's fields, owner (the group's name, or the family's display name through C6), claimant and done mark (through C6, korábbi tag after a removal), the history, the event links (BR185.2), and what the caller may do on it. A task or event of another community answers as if it did not exist. A caller with no active session gets the denied refusal, never an empty list. A teacher is returned no action at all.
    violation: Denied refusal (authorization_denied).
    source: FR1.2, FR14.5, AC14.2.3, contract C6
  - id: BR180.2
    statement: A task is managed by its owner's administrators and by nobody else.
    category: authorization
    applies_to: [TodoTask]
    trigger: todo_task_save, todo_task_set_attention, and the manager parts of BR182.3, BR183.2 and BR183.3
    logic: For a task owned by a working group the caller must satisfy can_manage_group(group), meaning a super admin or a coordinator of that group. For a family-owned task the caller must be a super admin, because a family has no administrators of its own and an administrator names the family (AC14.1.3). A coordinator of another group, a parent who manages nothing, a teacher and a caller with no active session are refused, and nothing of another group's task is changed (AC14.1.2). A coordinator creates tasks only for their own group and cannot move a task to another owner; a super admin may choose any group or family of the community. The check uses the grant at the moment of the call, so a coordinator whose grant ended is refused from the next request (BR189.2).
    violation: Denied refusal (authorization_denied); nothing changes.
    source: FR14.4, FR2.3, AC14.1.1, AC14.1.2, AC14.1.3, AC2.4.1
  - id: BR181.1
    statement: A task has a heading, an owner, and optional fields within fixed limits.
    category: validation
    applies_to: [TodoTask]
    trigger: todo_task_save, migration_load_todo
    logic: The topic is required, 1 to 200 characters after trimming. The owner is a working group of the community or a family of the community, never both. Priority is empty or 1 to 3. Description is up to 2000, materials (tools and materials) up to 500 and note up to 1000 characters, all optional. Status is open, in progress, done or postponed; saving through todo_task_save never sets done, which has its own command (BR183.2), and a new task starts open. A postponed task needs a note (BR183.1). The "not before" date and the deadline are optional dates, and "not before" may not be after the deadline. A past "not before" date is allowed.
    violation: Validation refusal on the field (for example topic_invalid, owner_invalid, not_before_after_deadline, note_required).
    source: FR14.3, AC14.1.1
  - id: BR181.2
    statement: A manager adds a task to their group's list and it appears there.
    category: policy
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_save (new)
    logic: A new task passes BR180.2 and BR181.1, is stored with status open, version 1 and no claimant, and one history row of kind created is written in the same transaction. It shows on the community list at once and on the group's management tab (BR187.1). A coordinator who hears of a repair from a teacher adds it here; the app has no separate reporting screen (AC2.4.2, FR2.5).
    violation: As BR180.2 and BR181.1.
    source: AC14.1.1, AC2.4.2, FR2.5
  - id: BR181.3
    statement: A manager changes a task as a whole, and the screen must still match what the manager saw.
    category: constraint
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_save (change)
    logic: The editor sends all editable fields with the task's version. A different version is refused and nothing is overwritten. A task that is done can still have its note and fields corrected, and keeps its done mark. A change that moves the owner is allowed only for a super admin (BR180.2). Saving clears needsAttention (BR190.1). The version goes up by one. One history row of kind edited is written, and, when the edit leaves the claimant's task changed, the claimant is told (BR188.1). A second press with the same idempotency key saves once.
    violation: Conflict refusal VERSION_CONFLICT or idempotency_key_reused; nothing changes.
    source: AC14.1.1, contract C1
  # --- Claiming ---------------------------------------------------------------------------------------
  - id: BR182.1
    statement: A parent with a family claims a task of any group, and a task owned by a family only if it is their own family; a task has one claimant.
    category: authorization
    applies_to: [TodoTask]
    trigger: todo_task_claim(task_id, p_expected_version, p_idempotency_key)
    logic: The caller needs an active parent record and a family (current_parent_id and current_family_id, C2); a teacher, a super admin without a family and any caller without a family are refused. IF the task is owned by a working group THEN any such parent may claim it, member of the group or not (AC14.2.2). IF it is owned by a family THEN the caller's family must be that family; anyone else is refused as for a task that does not exist for them to claim. The task must not be done, must have no claimant, and must not have a "not before" date after today, so a task that is not yet workable cannot be claimed from a link (managers can still change it). The task row is locked before the claimant is read, and after the lock the caller's active-parent record and active family are checked again, so a removal (U14) that committed in between leaves no claim for the removed person. A task that already has a claimant answers TODO_CLAIMED before the version is compared. Claiming sets claimedByParentId and claimedAt and raises the version (as do give-back and free). Of two people claiming at once one succeeds and the other is told it is taken. A repeated key returns the stored result. No family row is locked.
    violation: Denied refusal; TODO_CLAIMED (taken); TODO_DONE; TODO_NOT_YET; conflict VERSION_CONFLICT.
    source: FR14.5, AC14.2.2, AC14.1.3, Q2, NFR5
  - id: BR182.2
    statement: Claiming starts the work and giving the claim back reopens it.
    category: calculation
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_claim, todo_task_give_back, todo_task_free_claim
    logic: Claiming a task whose status is open or postponed sets it to in progress. Giving a claim back, or an administrator freeing it, clears claimedByParentId and claimedAt and sets a task that is in progress back to open; a postponed task stays postponed. Each change writes one history row (claimed, claim_given_back or claim_freed) with the old and new status and who did it. The change and its history row are one transaction.
    violation: Not applicable.
    source: FR14.3, AC14.2.2, Q3
  - id: BR182.3
    statement: The claimant gives their own claim back until the task is done; the owner's administrators can free any claim.
    category: authorization
    applies_to: [TodoTask]
    trigger: todo_task_give_back(task_id, p_expected_version, p_idempotency_key), todo_task_free_claim(task_id, p_expected_version, p_idempotency_key)
    logic: Giving back needs the caller to be the claimant and the task not done. Freeing needs the caller to be a manager of the task (BR180.2) and the task to have a claimant and not be done; a claim on a done task is freed only after the done mark is undone (BR183.3). Both refuse a task with no claimant and a teacher. Freeing another person's claim is audited without names (BR189.3) and tells the claimant (BR188.1). A repeated key returns the stored result.
    violation: Denied refusal; TODO_NOT_CLAIMED; TODO_DONE; conflict VERSION_CONFLICT.
    source: FR14.5, FR14.4, Q2, Q4
  # --- Status, notes and done -----------------------------------------------------------------------
  - id: BR183.1
    statement: Only the claimant and the owner's administrators change a claimed task's status and note, and a parent never sets done or open by hand.
    category: authorization
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_update(task_id, p_status, p_note, p_expected_version, p_idempotency_key)
    logic: The caller must be the claimant or a manager of the task (BR180.2); another parent, even of the claimant's family, and a teacher are refused (answer Q2). The task must not be done. The claimant may set the status to in progress or postponed and change the note; a manager may also set open. Setting postponed needs a non-empty note. Setting open through this command is refused while a claimant is set, because freeing the claim does that (BR182.3). The change writes a status_changed history row when the status changes, and the version goes up. A manager changing a task another person claimed tells that claimant (BR188.1). It does not change any other field; that is todo_task_save.
    violation: Denied refusal; TODO_DONE; status_not_allowed or note_required on the field; conflict VERSION_CONFLICT.
    source: FR14.3, FR14.5, AC14.1.3, AC14.2.2, Q2, Q3
  - id: BR183.2
    statement: The claimant or an administrator marks a task done, and the app records who and when.
    category: authorization
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_mark_done(task_id, p_expected_version, p_idempotency_key)
    logic: The caller must be the claimant or a manager of the task. The caller needs an active parent record, because who marked it is stored as a parent; a super admin with no parent record is refused with the reason, as for checklists (BR166.1). The task must not already be done. The task row is locked first and the caller's active-parent record and active family (for an administrator, the grant) are checked again after the lock, as in BR182.1. Marking sets status done, doneAt to now and doneByParentId to the caller, keeps the claimant, writes one marked_done history row and raises the version. The task then leaves the default view and stays in the history (BR184.1). A second person marking it from an outdated screen is refused and the task is marked once. A repeated key returns the stored result.
    violation: Denied refusal; TODO_DONE; no_parent_record; conflict VERSION_CONFLICT.
    source: FR14.5, FR14.6, AC14.2.2, Q2
  - id: BR183.3
    statement: A done mark is undone by whoever marked it or by an administrator.
    category: authorization
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_task_undo_done(task_id, p_expected_version, p_idempotency_key)
    logic: The caller must be the parent in doneByParentId or a manager of the task. The task must be done. Undoing clears doneAt and doneByParentId and sets the status to in progress when a claimant is still set, otherwise open (answer Q3). One history row of kind done_undone is written; the earlier marked_done row stays. Undoing another person's mark is audited (BR189.3). The claim, if any, is kept. A repeated key returns the stored result.
    violation: Denied refusal; TODO_NOT_DONE; conflict VERSION_CONFLICT.
    source: Q3, FR14.6
  # --- Viewing the list ----------------------------------------------------------------------------------
  - id: BR184.1
    statement: Done tasks and tasks with a future "not before" date stay out of the default view and can be shown on request.
    category: calculation
    applies_to: [TodoTask]
    trigger: todo_list(p_show_hidden, p_owner, p_status, p_priority)
    logic: The default result leaves out tasks whose status is done and tasks whose "not before" date is after today (AC14.2.1, FR14.6, FR14.7). With p_show_hidden true they are returned too, marked as done or as not yet due. Optional filters narrow by owner (a group or a family), by status and by priority; a filter that matches nothing returns an empty list with the filters echoed, which the screen shows as "Nincs találat". The order is priority 1 first and empty last, then deadline soonest first and empty last, then id. A teacher gets the same list. The list returns at most 500 tasks and says when it was cut.
    violation: Not applicable.
    source: FR14.6, FR14.7, AC14.2.1
  - id: BR184.2
    statement: The history of a task stays after it is done and is readable by everyone who may read the task.
    category: constraint
    applies_to: [TodoTaskHistory]
    trigger: todo_get
    logic: The history rows are returned oldest first with the kind of change, the old and new status, who (through C6, or "adminisztrátor" for an administrator without a parent record, "rendszer" for the system, korábbi tag after a removal) and when. A done task keeps every row (AC14.2.2). No row holds a note or other free text.
    violation: Not applicable.
    source: AC14.2.2, FR14.6, NFR11
  # --- Pulling tasks into an event ------------------------------------------------------------------
  - id: BR185.1
    statement: A manager of an event pulls open to-do tasks into its checklist, and the original stays on the list unchanged.
    category: policy
    applies_to: [TodoTask, TodoEventLink, TodoTaskHistory]
    trigger: todo_pull_to_event(event_id, todo_ids, p_expected_versions, p_idempotency_key) (contract C15)
    logic: The caller must be a super admin or satisfy can_manage_group for the event's group, and the event must be open (not cancelled, not finished), as for managing its checklist (BR164.1). One to 50 tasks are selected by id; each must exist in the community and must not be done; any task the caller can read may be pulled whatever its owner, because the checklist belongs to the event and its manager (the owner's rights are not widened: the original task is not changed). For each task in ascending id order the command calls checklist_add_task with source_ref set to the task id, the task's topic as the title, its priority and materials, and the section title "Teendők"; when the task has a claimant who is still an active parent of an active family, that parent is passed as the claimant, so an existing claim comes along (BR170.5 of U11). A task already pulled into this event returns its existing link and adds nothing, and skips the version check; a link whose checklist task no longer exists is replaced by the new pull. A claimed task's claimant becomes the first helper on the checklist task, and the confirmation says so; the claimant is not notified by the pull. Then one TodoEventLink and one history row of kind pulled_to_event naming the event are written, and the task's status, claimant and version are left as they were. The lock order is: the event row, the checklist head, its sections, the new checklist tasks (all inside checklist_add_task), then the selected to-do rows ascending, where the expected versions are checked; a task changed in the meantime fails the whole pull with a conflict. A repeated key returns the stored result and adds nothing a second time.
    violation: Denied refusal; EVENT_CLOSED; TODO_DONE; too_many_tasks; conflict VERSION_CONFLICT; the whole pull rolls back.
    source: FR14.8, AC14.3.1, AC2.4.1, Q1, contract C15
  - id: BR185.2
    statement: A pulled task says where it went and whether it was finished there, and a manager closes it by hand.
    category: policy
    applies_to: [TodoEventLink, TodoTask]
    trigger: todo_get, todo_list
    logic: A task with a link shows "Felvéve az eseményre: [esemény címe]" with a link to the event page, and, when the checklist task is done on that event, also "Az eseményen kész". When the checklist task or the event no longer exists it shows "Már nincs az esemény feladatlistáján". The state is read from the checklist when the task is read, through the internal read checklist_task_done_state, and nothing is written to the to-do task or to the checklist. Marking the checklist task done never marks the to-do task done; a manager of the to-do task closes it with Kész (BR183.2), and the checklist side never learns of to-do tasks.
    violation: Not applicable.
    source: AC14.3.1, Q1, contract C15 open point
  # --- My tasks -------------------------------------------------------------------------------------------
  - id: BR186.1
    statement: "My tasks" shows only the duties assigned to the caller's family, the recurring duties of their family and groups, and the to-do tasks they claimed.
    category: authorization
    applies_to: [TodoTask]
    trigger: my_tasks_get
    logic: The caller needs an active parent record and a family; a teacher, and a super admin with no family, get the denied refusal, never an empty page. The result is the family's duties that are not done (the existing duty read), the open occurrences of recurring duties from `recurring_my_occurrences` (U9, BR150.1), and the to-do tasks whose claimant is the caller and whose status is not done. It contains no open task to browse and no task nobody claimed (AC15.1.1, FR15.2); event checklist tasks are not included, they stay on the event page (answer Q5). Each row has a kind (duty, recurring, todo), a title, a date, a status and what the caller may do, which is the same Kész command as on the row's own screen, so no new right is created here. Nothing is shown of another family. A done row is not returned.
    violation: Denied refusal.
    source: FR15.1, FR15.2, AC15.1.1, Q5
  - id: BR186.2
    statement: The rows are grouped by the week they fall in, and an empty page says so and points to where to help.
    category: calculation
    applies_to: [TodoTask]
    trigger: my_tasks_get
    logic: A row's date is the duty's date, the occurrence's due date, or the to-do task's deadline. A row dated on or before the Sunday of the current week (Budapest week, Monday to Sunday) goes under "Ezen a héten", and one dated before today is also marked "Lejárt". A row dated later goes under "Később". A row with no date goes under "Nincs dátum". Within a group rows are ordered by date, then kind, then id. When all three groups are empty the result carries an empty-state flag, and the screen shows "Most nincs feladatotok." with links to the to-do list and to the animal-care sign-up (AC15.1.2).
    violation: Not applicable.
    source: AC15.1.1, AC15.1.2, FR15.1
  # --- The coordinator's management page ---------------------------------------------------------
  - id: BR187.1
    statement: A coordinator manages their group's events, to-do tasks, recurring duties and templates from one page, and nothing of another group.
    category: authorization
    applies_to: [TodoTask]
    trigger: todo_list_for_group(group_id) (contract C14), the page /szulo/munkacsoportok/[id]/kezeles
    logic: The page is opened by a caller who satisfies can_manage_group(group): a super admin or a coordinator of that group. Anyone else, a coordinator of another group included, gets the denied refusal. The four tabs read the group's lists by the C14 functions: `event_list_for_group(group_id, past)` (U10), `todo_list_for_group(group_id)` (this unit, rows of id, title which is the topic, and status), `recurring_list(group_id)` (U9) and `template_list(group_id)` (U11). The Teendők tab also offers adding and editing a task and freeing a claim through the commands of BR181 and BR182. The other three tabs show the group's items and open the existing editors of U9, U10 and U11, which stay where they are; this page replaces the temporary links those units placed on the group page. A group with no coordinator is still manageable by a super admin.
    violation: Denied refusal (authorization_denied).
    source: FR2.3, US2.4, AC2.4.1, AC2.4.2, Q6, contract C14
  # --- Notices -------------------------------------------------------------------------------------------
  - id: BR188.1
    statement: The claimant is told at once when an administrator changes or frees their task.
    category: policy
    applies_to: [TodoTask]
    trigger: todo_task_save, todo_task_update, todo_task_free_claim, todo_task_undo_done (by a manager)
    logic: When the caller is a manager and the task has a claimant who is not the caller, the claimant gets the notice kind todo_changed with the task as target (AC17.1.6), through notice_send (C8) in the same transaction. The once key is the task id and the version the change produced, so a repeated key sends nothing twice. When an administrator frees a claim the notice goes to the person whose claim it was. A change made by the claimant sends nothing. Only changes to the topic, description, materials, priority, deadline, "not before" date or owner, a status change, a freed claim and an undone done mark by a manager notify; an edit of the note alone does not. The text names the topic only and the notice opens the task page. Nothing is sent for a new task.
    violation: Not applicable; a failed email never fails the change (C8).
    source: FR17.4, AC17.1.1, AC17.1.6, Q4, NFR10, contract C8
  - id: BR188.2
    statement: Three days before a claimed task's deadline the claimant is reminded once.
    category: policy
    applies_to: [TodoTask]
    trigger: the daily check todo_deadline_reminder (contract C9)
    logic: For each task with a claimant who is an active parent, status not done, and a deadline, IF today is from three days before the deadline up to the deadline THEN send the notice kind todo_due with the task as target to the claimant. The once key is the task id with the claimant and the deadline date, so a new claimant after a claim change is reminded, a second run sends nothing and moving the deadline allows one new reminder for the new date. A task with no deadline, no claimant or a done status gets none; so does one whose deadline has passed. The check is registered with run kind daily and lock step 4 (after the existing checks; ties break by name), takes no task lock, is reached only through U5's run and is granted to no signed-in role. It returns created and skipped counts, and an error on one task is noted in the run's detail while the others still run (FR17.3).
    violation: Recorded in the run record; the other checks still run.
    source: FR17.3, FR17.4, AC17.1.1, AC17.1.6, Q4, contract C9
  # --- Locks, rights, audit, removal and the load -----------------------------------------------
  - id: BR189.1
    statement: Every to-do command is safe to repeat and to run twice at once, and takes its locks in one fixed order.
    category: constraint
    applies_to: [TodoTask, TodoTaskHistory, TodoEventLink]
    trigger: every command of this unit
    logic: Every command takes an idempotency key; a repeated key returns the stored result and a key used with other content is a conflict. A command that changes a task sends its version and a different version is refused. A command on one task locks that task row (C1 step "to-do task") and then writes its history row and notice. The pull locks in the order of BR185.1: the event row, the checklist rows, then the to-do rows ascending. No command locks a family row, and no checklist command locks a to-do row, so the two paths cannot wait on each other. The removal block locks the to-do rows ascending after the family row U14 has taken (BR190.1).
    violation: Conflict refusals idempotency_key_reused and VERSION_CONFLICT.
    source: NFR3, NFR5, contract C1
  - id: BR189.2
    statement: Every command and read checks the caller's right on the database side, and a revoked right applies at the next request.
    category: authorization
    applies_to: [TodoTask, TodoEventLink]
    trigger: every function of this unit
    logic: Commands start with revoke all and an explicit grant execute and refuse through U3R00. Rights come from C2 at the moment of the call, so a coordinator whose grant ended is refused from the next request. Application roles hold read access only and no table is written except through these functions. Internal functions (the daily check, the removal block, checklist_task_done_state, the notice facts) are never granted to a signed-in user, and migration_load_todo is granted to the service role only.
    violation: Denied refusal.
    source: NFR3, contract C1, contract C2
  - id: BR189.3
    statement: Administrator interventions on to-do tasks are audited without names or text.
    category: policy
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: another person's claim freed, another person's done mark undone, a task pulled into an event, a removal applied, a migration load
    logic: One audit entry records the action, the actor and the target ids, with the actions todo.claim_freed, todo.done_undone, todo.pulled_to_event, todo.removal_applied and todo.migration_loaded. It never holds a name, a topic or a note. The change rolls back when the entry cannot be written.
    violation: The change rolls back.
    source: NFR4, contract C1
  - id: BR190.1
    statement: Removing a parent or a family clears their names from to-do tasks and flags the open tasks that need an administrator.
    category: constraint
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: todo_removal_preview(subject_kind, subject_id) and todo_removal_apply(subject_kind, subject_id) (contract C16)
    logic: For a parent, apply clears doneByParentId on the tasks they marked done and changedByParentId on the history rows they made. For a claim they hold, apply clears claimedByParentId and claimedAt; when that task is not done, it is also flagged (needsAttention true), its status in progress goes back to open, and a history row of kind claimant_removed with actor system is written, so an administrator sees it on the "Teendő a távozás miatt" list (U14). For a family, apply flags every not-done task owned by that family (needsAttention true) and clears the same names for every parent of the family. Preview returns to_clear (task and history rows whose names would be cleared) and to_flag (tasks that would be flagged) and apply returns the same counts in the same transaction; a subject that holds nothing returns zero counts. Rows stay, shown as korábbi tag through C6, and the audit entry holds no names (BR189.3). Apply sets the flag through the internal function todo_task_set_attention(task_ids, flag), which is granted to no signed-in role. The flagged tasks are exposed by todo_list and todo_list_for_group (a needs-attention filter and field), which U14's "Teendő a távozás miatt" list reads; the group detail page reads todo_list filtered by owner group, so no other read is added. A task of a removed family shows its owner as "korábbi család" and a super admin can reassign it by saving it with a new owner. Apply locks the to-do rows ascending after U14's family row. An administrator's next save of the flagged task clears the flag (BR181.3).
    violation: Not applicable; internal.
    source: contract C16, NFR11, AC3.6.5
  - id: BR190.2
    statement: The one-off load creates the spreadsheet's to-do tasks once, however often it runs, and reports counts only.
    category: constraint
    applies_to: [TodoTask, TodoTaskHistory]
    trigger: migration_load_todo(source_key, payload) (contract C17)
    logic: Callable by the service role only. The payload holds topic, priority, description, materials, status, note, "not before" date, deadline, the owner (a working group's name or a family key) and, for a done task, the done date. The same validation as BR181.1 applies; the owner must exist in the community. A source_key that already exists returns the existing task and creates nothing, so a second run makes no duplicates. A done row is stored as done with doneAt from the sheet (the load date when the sheet has none), no claimant and no doneByParentId; it appears in the history view, not in the default list (the full list with done tasks is loaded, FR18.1). One history row of kind migrated with actor system is written. A row that fails validation returns a refusal, and the script reports its position and carries on. The result holds counts, never cell values. The load is audited (BR189.3) and takes no family lock.
    violation: Validation refusal with the failing field name only.
    source: FR18.1, FR18.4, contract C17
```

## Summary

| Question | Answer | Rule |
|---|---|---|
| Who sees the list? | Every signed-in reader; teachers read only | BR180.1 |
| Who manages a task? | The owner's administrators: a group's coordinators and super admins; a family-owned task, super admins | BR180.2 |
| What does a task hold? | Heading, owner, priority, description, materials, status, note, "not before" date, deadline | BR181.1 |
| Who claims? | A parent with a family; a family-owned task only its own family; one claimant | BR182.1 |
| What does claiming do to the status? | Open or postponed becomes in progress; giving back reopens it | BR182.2 |
| Who changes status, note, gives back, marks done? | The claimant and the owner's administrators | BR182.3, BR183.1, BR183.2 |
| How is a mistake fixed? | The claimant gives back; administrators free a claim; whoever marked done, or an administrator, undoes it | BR182.3, BR183.3 |
| What is in the default view? | Not done and not before "not before"; the rest on request | BR184.1 |
| What stays after done? | Every history row, with who and when | BR184.2 |
| How is a task pulled into an event? | A manager of the event pulls open tasks; the original is unchanged; a claim comes along | BR185.1 |
| Does finishing it on the event finish it here? | No; it shows "Az eseményen kész" and a manager presses Kész | BR185.2 |
| What is on My tasks? | The family's duties, recurring duties and claimed to-do tasks, by week; nothing to browse | BR186.1, BR186.2 |
| Who uses the management page? | The group's coordinators and super admins | BR187.1 |
| Which notices go? | A change by an administrator, at once; one reminder three days before a claimed task's deadline | BR188.1, BR188.2 |
| What happens on removing a person? | Names cleared; open claims and family-owned tasks flagged | BR190.1 |
| How does the spreadsheet load? | Once per source key, counts only | BR190.2 |

## Assumptions and open points

- **Family-owned tasks are managed by super admins only.** Requirements say an administrator names the family (AC14.1.3) and that "the owner's admins" manage a task (FR14.4). A family has no admins of its own, so a coordinator is not given a family's tasks. A coordinator may still ask a super admin, or add a group task. If the owner wants coordinators to create family-owned tasks, BR180.2 changes in one place.
- **A not-yet-due task cannot be claimed** (BR182.1) because it is hidden by default; managers may still change it. This is not in the requirements and is easy to drop.
- **The section "Teendők" on the event checklist** is named here; U11 creates it at the end of the parents' section list when missing (BR170.5 of U11).
- **The existing reads behind My tasks** (the family's duty read of U2 and U6, and `recurring_my_occurrences` of U9) are called, not rewritten; their exact function names are fixed in Code Generation.
