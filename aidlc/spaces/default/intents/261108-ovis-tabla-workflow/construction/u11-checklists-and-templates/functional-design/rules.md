# Business Rules: u11-checklists-and-templates

Built from `unit-of-work.md` (U11), `unit-of-work-story-map.md`, `stories.md` (US12.1 to US12.3, US13.1), `requirements.md` (FR2.3, FR11.10 to FR11.12, FR12, FR13, FR17.3, FR17.4, NFR3 to NFR6, NFR10, NFR11), `components.md`, `contract-summary.md` (C1, C2, C6 to C9, C13 to C16), `decisions.md` (ADR-005, ADR-006) and `functional-design-questions.md` (Q1 to Q8). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about scope and reach, and U10's rules about events (BR100 to BR124), still hold unless a rule here says it replaces one. Contains no names or contact details.

All times are Budapest time. As in U10, an event is *open* while it is planned and its end has not passed. The *organising team* of an event is its organisers (BR106.1, contract C13) plus everyone who may manage it (BR100.1); a *manager* is only the second part. A *claimable* task is a task in a parents' or an organisers' section.

## Rules

```yaml
rules:
  # --- Templates ---------------------------------------------------------------------------------
  - id: BR160.1
    statement: A super admin manages every template; a coordinator manages their own working group's templates, and nothing of another group.
    category: authorization
    applies_to: [ChecklistTemplate, TemplateSection, TemplateTask]
    trigger: template_save, template_set_removed, template_get, template_list_admin
    logic: IF the template has no working group THEN the caller must be a super admin. IF it has one THEN the caller must be a super admin or a coordinator of that group (can_manage_group, C2). A parent, a teacher, a coordinator of another group and a caller with no active session are refused. A template of another community answers as if it did not exist. A coordinator creates templates only for their own group; a super admin chooses a group or none.
    violation: Denied refusal (authorization_denied); nothing changes.
    source: FR12.4, FR2.3, AC12.2.1, AC12.2.2, Q5, contract C2
  - id: BR160.2
    statement: A template has a name, optional settings, and sections of a kind holding tasks with optional fields.
    category: validation
    applies_to: [ChecklistTemplate, TemplateSection, TemplateTask]
    trigger: template_save
    logic: The name is required, 1 to 200 characters after trimming, and not used by another template of the same owner, removed ones included (ignoring case). The description is optional, up to 1000. defaultLeadDays is empty or a whole number from 1 to 60. Each section has a title of 1 to 100 characters and a kind of parents, organisers or teachers. Each task has a title of 1 to 200 characters; place up to 200, props up to 300, materials up to 300 and tip up to 1000, all optional; priority empty or 1 to 3; summerOnly and timeMatters true or false; helpersNeeded 1 to 20, default 1. A task in a teachers' section is stored with helpersNeeded 1 and timeMatters false. At most 30 sections and 300 tasks. A template may have no sections at all.
    violation: Validation refusal on the field (for example name_taken, too_many_tasks, title_invalid).
    source: FR12.3, FR12.4, AC12.2.1, AC12.1.4, Q2, Q4, Q6
  - id: BR160.3
    statement: A template is saved as a whole and must still match what the editor saw.
    category: constraint
    applies_to: [ChecklistTemplate, TemplateSection, TemplateTask]
    trigger: template_save
    logic: The editor sends the template with all its sections and tasks in order, and for a change the template's version. The saved sections and tasks replace the old ones in one transaction, so positions are always 1 to the count. A different version is refused and nothing is overwritten. Editing a removed template is allowed, so it can be fixed before restoring.
    violation: Conflict refusal (VERSION_CONFLICT); nothing changes.
    source: AC12.2.1, contract C1
  - id: BR161.1
    statement: Removing a template hides it from new events and keeps it, and whoever may edit it may restore it.
    category: policy
    applies_to: [ChecklistTemplate]
    trigger: template_set_removed(template_id, removed, p_expected_version, p_idempotency_key)
    logic: The caller must pass BR160.1 for the template. Removing sets isRemoved and removedAt; restoring clears both. A removed template is not offered when an event is created (BR163.2) and is listed under "Eltávolított" for those who manage it. Nothing is deleted, and events already copied from it do not change (BR163.3). Removing or restoring twice in a row changes nothing more. Audited (BR170.3).
    violation: Denied or conflict refusal (VERSION_CONFLICT).
    source: FR12.7, AC12.2.3, A4, Q5
  - id: BR161.2
    statement: The template lists show each manager the templates they may manage, and the event form shows the templates the caller may start from.
    category: authorization
    applies_to: [ChecklistTemplate]
    trigger: template_list_admin, template_list(group_id) (contract C14), template_options(group_id)
    logic: template_list_admin returns, for a super admin, every template of the community, and for a coordinator, their groups' templates, with name, group, number of tasks and status active or removed. template_list(group_id) returns rows of id, title (the name) and status for that group's templates; the caller must satisfy can_manage_group, otherwise the denied refusal (C14). template_options(group_id) returns the active templates the caller may start an event from (BR163.2), with name, defaultLeadDays and whether it has summer-only tasks. No list is readable by a parent who manages nothing or by a teacher; they get the denied refusal, never an empty list.
    violation: Denied refusal.
    source: FR12.4, AC12.2.3, Q5, contract C14
  - id: BR162.1
    statement: A fresh install holds the big-cleaning, ship-repair and eight festival templates as community templates.
    category: policy
    applies_to: [ChecklistTemplate, TemplateSection, TemplateTask]
    trigger: checklist_starting_templates_install(community_id), called by the local seed and, in the later hosting work, once when the hosted community is set up
    logic: The starting content ships with the database in this unit's migration as an internal install function, granted to the service role only, so a hosted database gets the same templates as the local one and the content is not test data. It adds, for the community, the community templates "Nagytakarítás", "Hajó javítás" and the festival templates Szent Mihály, Szent Márton, Szent Miklós, Spirál járás, Húsvét, Pünkösd, Gyermekek búcsúnapja and Búcsúzás/nyárünnep, written in Hungarian from the spreadsheet review. Nagytakarítás has one parents' section per area of appendix C with its tasks (the "NYÁRON" ones as summerOnly, without the prefix), timeMatters on its tasks, the tips of appendix D on the matching tasks, an organisers' section with the organiser's list of appendix D, and defaultLeadDays 14. Hajó javítás has one parents' section per topic of appendix E, with priorities and tools, and no task done. Each festival template has the parents' tasks of appendix F in a parents' section and the teachers' tasks in a teachers' section; a festival with no listed task has no section. A template whose name the community already has is skipped, so running the install twice adds nothing. The content holds no person's name or contact detail; it is the same list in every install and the owner changes it in the app.
    violation: Not applicable; internal.
    source: FR12.8, AC12.3.3, Q8, NFR1
  # --- Copying a template into an event ------------------------------------------------------------
  - id: BR163.1
    statement: An event takes its own copy of a template, with every task unclaimed and the summer-only tasks only in a summer event.
    category: calculation
    applies_to: [EventChecklistSection, EventChecklistTask]
    trigger: checklist_copy_template(event_id, template_id, p_idempotency_key)
    logic: The template's sections and tasks are copied in order into the event's checklist with every field (title, place, props, priority, materials, tip, summerOnly, helpersNeeded, timeMatters) and the section kinds. IF event_is_summer(event) is true at the copy THEN summerOnly tasks are copied, OTHERWISE they are left out. A section left with no task is not copied. No claim, done mark or deadline is copied. The copy creates the event's checklist head record (EventChecklist) when it does not exist yet, and its copiedFromTemplateId records the template for information only. Changing the event's summer setting later does not change the copy; the managers add or remove such tasks by hand (BR164.1).
    violation: Not applicable.
    source: FR12.5, FR12.6, AC12.3.1, AC12.3.2, AC12.1.4, ADR-005, contract C13
  - id: BR163.2
    statement: A manager copies an active template they may start from into an open event whose checklist is still empty.
    category: authorization
    applies_to: [ChecklistTemplate, EventChecklistSection]
    trigger: checklist_copy_template
    logic: The caller must be a manager of the event (BR100.1). The template must be active and of the same community. A super admin may start from any active template. A coordinator may start from a community template or a template of their own group. The event must be open, and its checklist must have no section yet; the event form offers the choice only when the event is created and calls this right after saving it, and an event whose copy failed shows the choice again while its checklist is empty. A repeated key returns the stored result.
    violation: Denied refusal; TEMPLATE_UNAVAILABLE for a removed, unknown or out-of-reach template; CHECKLIST_NOT_EMPTY; EVENT_CLOSED.
    source: AC12.2.3, AC12.3.1, Q5, Q7
  - id: BR163.3
    statement: Changing or removing a template never changes an event that was copied from it.
    category: constraint
    applies_to: [ChecklistTemplate, EventChecklistTask]
    trigger: template_save, template_set_removed
    logic: The copy holds its own values and no live reference. No template command reads or writes an event's checklist. Restoring a template changes no event either.
    violation: Not applicable.
    source: FR12.5, AC12.2.4, ADR-005
  # --- Changing an event's own checklist -----------------------------------------------------------
  - id: BR164.1
    statement: The managers of an open event may add, change and reorder its checklist; organisers who are not managers may not.
    category: authorization
    applies_to: [EventChecklist, EventChecklistSection, EventChecklistTask]
    trigger: checklist_section_save, checklist_section_remove, checklist_task_save, checklist_task_remove, checklist_reorder
    logic: The caller must be a manager of the event (BR100.1); a parent marked as organiser is refused, as in BR106.2. The event must be open; a cancelled or finished event's checklist is read-only. Section and task fields follow the limits of BR160.2, and a task's deadline is optional and not after the date of the event's end. At most 30 sections and 300 tasks per event. A change of a section's title or kind sends the section's version, and a change of a task sends the task's version. Reordering, and adding or removing a section or a task, sends the checklist's own version (EventChecklist), which then goes up; reordering also sends the full order of its sections and of the tasks in each. No command of this unit reads or changes the event's version.
    violation: Denied refusal, EVENT_CLOSED, conflict (VERSION_CONFLICT) or validation refusal on the field.
    source: ADR-005, Q7, FR12.3, FR2.3
  - id: BR164.2
    statement: A task with a claim or a done mark cannot be deleted, and changing it keeps its claims.
    category: constraint
    applies_to: [EventChecklistTask, ChecklistClaim]
    trigger: checklist_task_remove, checklist_section_remove, checklist_task_save
    logic: IF a task has a claim or a done mark THEN deleting it, or deleting its section, is refused; the claims must be removed (BR165.4) and the done mark undone (BR166.2) first. Changing a task's fields keeps its claims and done mark. helpersNeeded may not go below the number of claims it has. Turning timeMatters off keeps the times already chosen. Deleting a section deletes its tasks when none has a claim or a done mark.
    violation: Conflict refusal TASK_HAS_CLAIMS or validation refusal on helpers_needed (below_claims).
    source: Q7, Q2
  - id: BR164.3
    statement: A task stays with the kind of people it was taken by.
    category: constraint
    applies_to: [EventChecklistSection, EventChecklistTask]
    trigger: checklist_section_save, checklist_task_save
    logic: The kind of a section cannot change, and a task cannot move to a section of another kind, while the task or one in the section has a claim or a done mark. Moving a task to another section of the same kind is allowed.
    violation: Conflict refusal SECTION_HAS_CLAIMS.
    source: Q4
  # --- Taking a task ---------------------------------------------------------------------------------
  - id: BR165.1
    statement: A parent with a family may take a parents' task of an open event; only the organising team may take an organisers' task; nobody takes a teachers' task.
    category: authorization
    applies_to: [ChecklistClaim, EventChecklistTask]
    trigger: checklist_claim(task_id, p_note, p_chosen_at, p_idempotency_key)
    logic: The caller needs an active parent record and a family (current_family_id, C2); a teacher, and any caller without a family, is refused. IF the task is in a parents' section THEN any such parent of the community may take it. IF it is in an organisers' section THEN the caller must be in the organising team; anyone else gets the same answer as for a task that does not exist. IF it is in a teachers' section THEN it is refused. The event must be open. The sign-up deadline is shown and blocks nothing (as BR108.4). The leaving and new family rule does not apply, because a checklist task is not a duty (Q3).
    violation: Denied refusal; CHECKLIST_TASK_UNAVAILABLE; TASK_NOT_CLAIMABLE; EVENT_CLOSED.
    source: FR12.2, AC12.1.1, FR13.1, Q3, Q4, contract C2
  - id: BR165.2
    statement: A task takes at most its number of helpers, each person once, and a full task tells the next person it is taken.
    category: constraint
    applies_to: [ChecklistClaim, EventChecklistTask]
    trigger: checklist_claim, checklist_claim_typed
    logic: The task row is locked before its claims are counted. IF the task already has helpersNeeded claims THEN the claim is refused as taken. IF the caller already holds a claim on the task THEN the claim is refused as already taken by them. IF the task is done THEN it is refused. Otherwise one claim is added with the caller's parent and family, and the name is shown on the task (C6). A repeated key returns the stored result; of two people taking the last place at once, one gets it and the other is told it is taken.
    violation: Conflict refusal TASK_TAKEN, ALREADY_CLAIMED or TASK_DONE.
    source: AC12.1.1, AC12.1.2, Q2, NFR5
  - id: BR165.3
    statement: A claim may carry a note and, when the task's time matters, a chosen date and time.
    category: validation
    applies_to: [ChecklistClaim]
    trigger: checklist_claim, checklist_claim_change
    logic: The note is optional, up to 500 characters after trimming; it can say, for example, how many rag rugs the family took home. chosenAt is accepted only when the task's timeMatters is true and must fall between the event's start and end. The parent who made a claim may change its note and time while the event is open, sending the claim's version. IF the event's dates change later so that a chosen time falls outside them THEN the time is kept, the read marks it as outside the event, the page shows "Az időpont kívül esik az esemény idején" beside it, and the helper may pick a new one; the change notice of U10 already reaches them (BR170.6).
    violation: Validation refusal on note or chosen_at (not_offered, outside_event); conflict (VERSION_CONFLICT).
    source: FR13.6, AC13.1.5, FR11.11
  - id: BR165.4
    statement: A parent may give up their own claim until the task is done; the organising team may remove any claim.
    category: authorization
    applies_to: [ChecklistClaim]
    trigger: checklist_claim_withdraw(claim_id, p_expected_version, p_idempotency_key)
    logic: IF the caller made the claim THEN they may withdraw it while the task is not done and the event has not finished, also when the event is cancelled, as with U10's sign-ups (BR118.1). IF the caller is in the organising team THEN they may remove any claim of a task that is not done while the event is open; a claim on a done task can be removed only after the done mark is undone. On a cancelled or finished event the organising team removes nothing. A withdrawn claim is deleted and its place is free again. Removing another person's claim is audited (BR170.3). A repeated key returns the stored result.
    violation: Denied refusal, TASK_DONE, EVENT_CLOSED or conflict (VERSION_CONFLICT).
    source: Q3, FR12.2
  - id: BR165.5
    statement: The organising team may enter a helper without an account by name.
    category: authorization
    applies_to: [ChecklistClaim]
    trigger: checklist_claim_typed(task_id, p_name, p_note, p_chosen_at, p_idempotency_key)
    logic: The caller must be in the organising team and the task must be claimable and not done, in an open event. The name is 1 to 200 characters after trimming. The claim counts towards helpersNeeded (BR165.2) and is shown as typed, with no link and no profile. The organising team may remove it (BR165.4).
    violation: Denied refusal, TASK_TAKEN, TASK_DONE, EVENT_CLOSED or validation refusal on name.
    source: FR11.10, AC11.3.3, Q3
  - id: BR165.6
    statement: Taking a checklist task counts towards nothing.
    category: policy
    applies_to: [ChecklistClaim]
    trigger: every reader of rotas, fair share, family standing and duty reminders
    logic: No rota, animal-care fair-share, standing or duty-reminder function reads checklist claims or done marks.
    violation: Not applicable.
    source: FR11.12
  # --- Marking done ----------------------------------------------------------------------------------
  - id: BR166.1
    statement: A helper of a task, or the organising team, marks it done, and the app records who and when.
    category: authorization
    applies_to: [EventChecklistTask]
    trigger: checklist_task_mark_done(task_id, p_expected_version, p_idempotency_key)
    logic: The caller must hold a claim on the task, or be in the organising team (the closing round, also for a task nobody claimed). The caller needs an active parent record, because who marked it is stored as a parent. The task must be claimable and not done, and the event must be open; a cancelled or finished event refuses. Marking sets doneAt to now and doneByParentId to the caller, and the task's version goes up. A repeated key returns the stored result; a second person marking the same task from an outdated screen is refused, and the task stays done once.
    violation: Denied refusal, TASK_NOT_CLAIMABLE, TASK_DONE, EVENT_CLOSED or conflict (VERSION_CONFLICT).
    source: FR12.2, AC12.1.3, FR13.5, Q2, Q3
  - id: BR166.2
    statement: A done mark can be undone by whoever marked it or by the organising team.
    category: authorization
    applies_to: [EventChecklistTask]
    trigger: checklist_task_undo_done(task_id, p_expected_version, p_idempotency_key)
    logic: The caller must be the parent in doneByParentId or in the organising team, and the event must be open; a cancelled or finished event keeps its done marks. Undoing clears doneAt and doneByParentId and keeps the claims. Undoing another person's mark is audited (BR170.3).
    violation: Denied refusal, EVENT_CLOSED or conflict (VERSION_CONFLICT).
    source: Q3
  # --- Reading an event's checklist --------------------------------------------------------------------
  - id: BR167.1
    statement: Every signed-in reader of the community sees an event's parents' and teachers' sections; only the organising team sees its organisers' sections.
    category: authorization
    applies_to: [EventChecklistSection, EventChecklistTask, ChecklistClaim]
    trigger: checklist_get(event_id)
    logic: Returns the sections in order with their tasks, each task with its fields, tip, Nyáron tag, helpers taken and needed, the claims (the parent's display name and family name through C6, or the typed name, with the note and chosen time) and the done mark (who and when). IF the caller is not in the organising team THEN organisers' sections and their tasks are left out entirely. Teachers read everything else and can change nothing. Also returns the caller's own claims, what the caller may do on each task, and the event's sign-up deadline. A caller with no access to the event gets the denied refusal, never an empty list.
    violation: Denied refusal.
    source: AC12.1.1, AC12.1.4, AC13.1.1, FR13.1, Q4, contract C6
  - id: BR167.2
    statement: When every claimable task is done, the organising team is shown that the closing round can start.
    category: calculation
    applies_to: [EventChecklistTask]
    trigger: checklist_get
    logic: allDone is true when the event has at least one claimable task and every claimable task, in the parents' and the organisers' sections, has a done mark; teachers' tasks do not count. It is returned to the organising team only, and the page then shows "Minden kész: jöhet a záró kör."
    violation: Not applicable.
    source: FR13.5, AC13.1.4
  - id: BR167.3
    statement: Parents see the sign-up deadline on the event.
    category: constraint
    applies_to: [Event]
    trigger: event_get (U10), checklist_get
    logic: The deadline (event_deadline, C13) is returned with the checklist and shown above it when set. Nothing is refused after it (BR165.1).
    violation: Not applicable.
    source: FR13.3, AC13.1.3, contract C13
  # --- The two timed notices -------------------------------------------------------------------------
  - id: BR168.1
    statement: The lead-time notice goes once, when the event's lead time is reached, to everyone the event is for.
    category: policy
    applies_to: [Event]
    trigger: the daily check event_lead_notice (contract C9)
    logic: For each event with a noticeLeadDays, that is planned, has not started, and whose start date minus noticeLeadDays is today or earlier, send the notice kind event_lead_time with the event as target. The recipients are the same people U10's event_save selects for its new-event notice (BR117.1): for a community event every active parent with an account whose family is active, and for a group event the group's members (C7). Unlike the new-event notice, the creator is not left out, because this is a reminder for everyone. The once key is the event id, so a second run, a later change of the lead time or of the dates sends nothing more. An event created or given a lead time inside the window gets it at the next run. An event with no lead time gets none.
    violation: Not applicable.
    source: FR13.2, AC13.1.2, AC13.1.6, Q6, contract C8
  - id: BR168.2
    statement: Three days before the sign-up deadline the organisers are told, once, that tasks are still free.
    category: policy
    applies_to: [EventChecklistTask, ChecklistClaim]
    trigger: the daily check checklist_unclaimed_alert (contract C9)
    logic: For each planned event that has not started and has a signupDeadline, IF today is from three days before the deadline up to the deadline AND a task in a parents' section is not done and has fewer claims than helpersNeeded THEN send the notice kind checklist_unclaimed with the event as target to the event's organisers (C13). The once key is the event id with the deadline date, so moving the deadline allows one new alert for the new date. An event with no deadline gets none. The notice names the event only, never who took or left a task.
    violation: Not applicable.
    source: FR13.4, AC13.1.3, Q6, NFR10, contract C8, contract C13
  - id: BR168.3
    statement: Both checks run without anyone signing in, are safe to run twice, and one failing event does not stop the others.
    category: constraint
    applies_to: [Event, EventChecklistTask]
    trigger: timed_checks_run_system (contract C9)
    logic: Both are registered with run kind daily and lock step 4, reached only through U5's run, and granted to no signed-in role. Each returns created and skipped counts. They read only and send through notice_send, taking no checklist lock. An error on one event is noted in the run's detail and the others still run.
    violation: Recorded in the run record; the other checks still run.
    source: FR17.3, ADR-006, contract C9
  # --- Today's event tasks -------------------------------------------------------------------------------
  - id: BR169.1
    statement: A duty can no longer be linked to an event; the event's checklist replaces today's event tasks.
    category: policy
    applies_to: [DutyTask]
    trigger: task_save
    logic: IF a save would create a link to an event (a new task with an event, or an existing task given an event it did not have, or moved to another event) THEN it is refused on the event field. Saving an already-linked task with its unchanged event, which today's task screen does on every edit, and removing the link are allowed. Tasks with no event work as before. The task form no longer shows the event choice, and no screen of the event shows duties. Rows linked to an event before this change (invented local data, reset) keep working, and U10's cancel rule still closes them. Contract C4's event_task origin is not used by any unit.
    violation: Validation refusal on event_id (retired).
    source: Q1, unit-of-work.md U10 notes
  # --- Locks, repeats, audit, removal and contracts ---------------------------------------------------------
  - id: BR170.1
    statement: Every checklist command locks in a fixed order and is safe to repeat and to run twice at once.
    category: constraint
    applies_to: [ChecklistTemplate, EventChecklistSection, EventChecklistTask, ChecklistClaim]
    trigger: every command of this unit
    logic: An event command takes the event row first (as U10), then the event's checklist head row (EventChecklist), then the event's sections by ascending id when it needs them, then its checklist tasks by ascending id (C1 checklist task step), then their claims by ascending id. A template command takes the template row, then its sections and tasks; it never locks an event. The copy locks the event, then reads the template without locking it. Every command takes an idempotency key and a repeated key returns the stored result; a changing command takes the version of the row it changes; a key reused with other content is a conflict. No command locks a family row.
    violation: Conflict refusals idempotency_key_reused and VERSION_CONFLICT.
    source: NFR3, NFR5, contract C1
  - id: BR170.2
    statement: Every command and read checks the caller's right on the database side, and a revoked right applies at the next request.
    category: authorization
    applies_to: [ChecklistTemplate, EventChecklistTask, ChecklistClaim]
    trigger: every function of this unit
    logic: Commands start with revoke all and an explicit grant execute and refuse through U3R00. Rights come from C2 and C13 at the moment of the call, so a coordinator whose grant ended, or a parent whose organiser role was removed, is refused from the next request. Internal functions (C15, C16, the two checks) are never granted to a signed-in user.
    violation: Denied refusal.
    source: NFR3, contract C1, contract C2
  - id: BR170.3
    statement: Administrator interventions on checklists and templates are audited without names or text.
    category: policy
    applies_to: [ChecklistTemplate, ChecklistClaim, EventChecklistTask]
    trigger: template removed or restored, another person's claim removed, another person's done mark undone, removal apply
    logic: One audit entry records the action, the actor and the target ids, with the actions checklist.template_removed, checklist.template_restored, checklist.claim_removed, checklist.done_undone and checklist.removal_applied. It never holds a name, a note or a task title. The change rolls back when the entry cannot be written.
    violation: The change rolls back.
    source: NFR4, contract C1
  - id: BR170.4
    statement: Removing a parent or a family frees their open claims and anonymises the rest.
    category: constraint
    applies_to: [ChecklistClaim, EventChecklistTask]
    trigger: checklists_removal_preview and checklists_removal_apply (contract C16)
    logic: For a parent, or every parent of a family, a claim on a task that is not done in an event that has not finished is deleted, so its place is free again. Every other claim keeps its row and loses parentId and familyId. doneByParentId is cleared on the tasks they marked done. Preview returns how many rows would change (to_clear) and zero to flag (to_flag); apply returns the same counts in the same transaction. Kept rows show korábbi tag through C6. Apply locks in the C1 order (checklist tasks ascending, then claims ascending). A subject that holds nothing returns zero counts.
    violation: Not applicable; internal.
    source: contract C16, NFR11, AC3.6.5
  - id: BR170.5
    statement: Another unit adds a task to an event's checklist through one internal function.
    category: constraint
    applies_to: [EventChecklistTask, EventChecklistSection]
    trigger: checklist_add_task(event_id, task_fields, source_ref, claimant) (contract C15)
    logic: It locks in the order of BR170.1: the event row first, then the checklist head row (created if missing), then the section, then the new task. task_fields hold a section title and the task's title, place, props, priority and materials. The task goes at the end of the event's parents' section with that title, which is created at the end if missing. IF source_ref is set and the event already has a task with it THEN that task's id is returned and nothing is added or claimed. The optional claimant is either a parent id or a typed name. IF it is a parent who is still active in an active family THEN one claim is added for that parent and family; IF it is a typed name THEN one typed claim is added (as BR165.5); IF the parent is no longer active THEN the task arrives with no claim. This is how U12 carries over an existing claim (C15). The event must be open and within the limits of BR164.1. It knows nothing about to-do tasks and checks no caller right; the calling command does (C15). Returns the checklist task id.
    violation: EVENT_CLOSED or a validation refusal, raised to the caller.
    source: contract C15, FR14.8, AC14.3.1
  - id: BR170.6
    statement: The parents holding a claim on an event are told when it is cancelled or its dates or place change.
    category: policy
    applies_to: [ChecklistClaim, Event]
    trigger: checklist_claimant_ids(event_id), read by U10's event_save when it sends event_cancelled or event_changed
    logic: The internal function returns the ids of the active parents who hold a claim on a task of the event, with no duplicates, empty for an unknown event. This unit's migration extends the recipient list of U10's cancellation and change notice (BR117.2) with these parents, replacing the holders of today's event tasks, which no longer exist for new events (BR169.1). The once keys and texts of the notices do not change. It is read only and never granted to a signed-in user.
    violation: Not applicable; internal.
    source: BR117.2, owner answer Q1, contract C8
```

## Summary

| Question | Answer | Rule |
|---|---|---|
| Who manages templates? | Super admins all; coordinators their own group's | BR160.1 |
| What is in a template? | Sections for parents, organisers or teachers, and tasks with optional fields, number of helpers and "time matters" | BR160.2 |
| What does removing a template do? | Hides it from new events; it can be restored; events do not change | BR161.1, BR163.3 |
| What does a fresh install hold? | Big cleaning, ship repair and eight festivals, as community templates | BR162.1 |
| What does an event copy? | Every section and task, unclaimed; summer-only tasks only in a summer event | BR163.1 |
| Who starts an event from a template? | A manager, from a template they may use, into an empty checklist | BR163.2 |
| Can the event's list change later? | Managers add, change and reorder; claimed or done tasks cannot be deleted | BR164.1, BR164.2 |
| Who takes a task? | A parent with a family; organisers' tasks only the organising team; teachers' tasks nobody | BR165.1 |
| How many per task? | Up to its number of helpers, each person once; then "taken" | BR165.2 |
| What can a claim say? | A note (for example rag rugs) and a time when the time matters | BR165.3 |
| How is a mistake fixed? | Give up your own claim; the organising team removes claims and undoes done marks | BR165.4, BR166.2 |
| Who marks done? | A helper, or the organising team at the closing round; who and when are recorded | BR166.1 |
| Who sees the organiser's list? | The organising team only | BR167.1 |
| When is the closing round shown? | When every parents' and organisers' task is done | BR167.2 |
| When do the timed notices go? | Lead time: once, to everyone the event is for. Unclaimed: once, three days before the deadline, to the organisers | BR168.1, BR168.2 |
| What happens to today's event tasks? | No new links; the checklist replaces them | BR169.1 |
| Who hears that an event is cancelled or moved? | Also the parents holding a checklist claim | BR170.6 |
| How does U12 keep a person on a pulled task? | checklist_add_task takes an optional claimant | BR170.5 |
| Where do the starting templates live? | In an install function shipped with the database | BR162.1 |
| What happens on removing a person? | Open claims are freed; other claims and done marks are anonymised | BR170.4 |
