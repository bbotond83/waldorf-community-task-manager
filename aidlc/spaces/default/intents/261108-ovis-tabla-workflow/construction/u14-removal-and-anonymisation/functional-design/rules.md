# Business Rules: u14-removal-and-anonymisation

Built from `unit-of-work.md` (U14), `unit-of-work-story-map.md` (US3.6), `stories.md` (AC3.6.2, AC3.6.4 to AC3.6.7), `requirements.md` (FR3.7, NFR1, NFR11), `components.md` (Lifecycle), `contract-summary.md` (C1, C6, C16 and the deltas of U6, U10, U12, U13) and `functional-design-questions.md` (Q1 to Q8). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. U1's reach rules and U3's directory rules (BR36.1 to BR36.4) still hold. Contains no names or contact details.

A *subject* is the parent or family being removed. *Removal* archives the subject and runs every removal step. The *later delete or anonymise* is today's data-lifecycle run on a family that has been archived for at least 30 days. A *step* is one component's pair of preview and apply functions from contract C16.

## Rules

```yaml
rules:
  # --- Who may remove, and what is checked first ---------------------------------------------
  - id: BR200.1
    statement: Only a super admin removes a parent or a family, previews a removal, reads the flagged items or runs the later delete or anonymise.
    category: authorization
    applies_to: [RemovalSubject, RemovalPreview, FlaggedItem, LifecycleOutcome]
    trigger: parent_remove, family_archive, removal_preview, removal_flagged_items, lifecycle_run
    logic: IF the caller has no active session THEN refused. IF the caller is not a super admin of the subject's community THEN refused. A group admin, a teacher or a parent is refused even for their own family. A subject of another community answers as not found. The step functions themselves are granted to no role and are called only from these commands (C16).
    violation: Denied refusal (session_inactive or authorization_denied); not found answers parent_not_found or family_not_found.
    source: FR3.7, NFR1, contract C1, contract C16
  - id: BR200.2
    statement: A family's last active parent cannot be removed on their own; the whole family is removed instead.
    category: constraint
    applies_to: [RemovalSubject, Parent]
    trigger: parent_remove, removal_preview
    logic: IF the subject is a parent AND they are the only active parent of their family THEN the removal is refused, and the preview carries the same refusal so the screen shows the way to the family instead of a button. This keeps U3's rule (BR36.2).
    violation: Conflict refusal (PARENT_LAST_IN_FAMILY).
    source: Q1, AC3.6.4, contract C16 open point
  - id: BR200.3
    statement: A removal acts only on the version the administrator confirmed, and a repeated click does nothing twice.
    category: validation
    applies_to: [RemovalSubject]
    trigger: parent_remove, family_archive, lifecycle_run
    logic: Each command takes an idempotency key and the subject's expected version. IF the key was used with the same request THEN the stored result is returned and nothing runs again. IF the key was used with a different request THEN refused. IF the version read after the family lock differs from the expected one, or the subject is no longer in the state the command needs (an active parent or family for removal, an archived family for the later run) THEN refused and nothing changes.
    violation: Conflict refusal (idempotency_key_reused, VERSION_CONFLICT for removal, LIFECYCLE_STALE for the later run).
    source: contract C1, NFR5 (team rule on outdated screens and repeated clicks)
  # --- Running the removal -------------------------------------------------------------------
  - id: BR201.1
    statement: Removing a parent or a family runs every component's removal step in one transaction, after the family row is locked.
    category: policy
    applies_to: [RemovalSubject, RemovalStep, RemovalReport]
    trigger: parent_remove, family_archive
    logic: The command locks the family row first (also when removing one parent), checks BR200.1 to BR200.3, then calls each step's apply in the order of BR201.2 with the subject. The directory step archives the parent, or every parent, the children and the family, ends sign-ins and empties contact details and sharing choices (U3's step, which also covers U1's sign-in step). IF any step refuses or fails THEN the whole removal rolls back and the subject is unchanged. After the commit the server ends the sessions of every account named in the report. The previous family-archive body, which only freed places and archived rows, is replaced by this run.
    violation: The refusal of the step is returned unchanged; nothing is written.
    source: AC3.6.4, AC3.6.6, Q8, contract C16
  - id: BR201.2
    statement: The steps run in the fixed order of contract C16.
    category: constraint
    applies_to: [RemovalStep]
    trigger: parent_remove, family_archive, lifecycle_run, removal_preview
    logic: The order is rota_planning (U6), dutychanges (U7), duties (U2, built by U14), checklists (U11), todo (U12), library (U13), events (U10), recurring_duties (U9), notifications (U5), working_groups (U4), directory (U3). working_groups always runs before directory, because directory clears the account link that working_groups needs to find the coordinator grants. The preview reads the steps in the same order. A step returns zero counts for a subject it holds nothing of.
    violation: Not applicable; the order is fixed in the command.
    source: Q8, contract C16
  - id: BR201.3
    statement: Every removal writes one audit row with the counts of each step and no personal details.
    category: policy
    applies_to: [RemovalReport]
    trigger: parent_remove, family_archive
    logic: In the same transaction the command writes one audit row, lifecycle.parent_removed or lifecycle.family_removed, naming the subject by id and holding, per step, the cleared and flagged counts. Steps that write their own audit rows keep doing so. The audit log is append-only and its actor ids are never rewritten (C16). IF the audit write fails THEN the removal rolls back.
    violation: The removal rolls back.
    source: AC3.6.4, AC3.6.6, contract C16
  - id: BR201.4
    statement: Two administrators removing the same subject at once, or removing a parent while their family is removed, end with one removal.
    category: constraint
    applies_to: [RemovalSubject]
    trigger: parent_remove, family_archive
    logic: Both commands lock the family row first, so the second waits. When it continues, the subject is no longer active or its version changed, so BR200.3 refuses it. A step that another command already ran finds nothing left and returns zero counts.
    violation: Conflict refusal (VERSION_CONFLICT) for the second command.
    source: NFR5 (team rule on two people acting at once), contract C16
  # --- Duties and the new duties step --------------------------------------------------------
  - id: BR202.1
    statement: Removing a family frees its future places on manual duties and keeps its other future places, flagged for reassignment.
    category: policy
    applies_to: [Place, FlaggedItem]
    trigger: the duties step of family_archive
    logic: IF the subject is a family THEN each of its future places (the duty starts after now and the place is not removed) is handled by the duty's origin. A manual duty's place becomes removed, its reminders are planned again and the duty shows a free place, as archiving does today. A place on a rota-week, weekend-slot or animal-care-slot duty keeps the family. Because the family is no longer active, it appears on the existing flagged-duties list (U6's BR60.5) until an administrator reassigns it, and the family is shown as korábbi család. The DUTY_ROTA_MANAGED refusal of today's family archive goes away. Preview counts freed places as to_clear and kept places as to_flag. IF the subject is a parent THEN the step holds nothing (zero counts), because places belong to families.
    violation: Not applicable; the step only counts and frees.
    source: AC3.6.2, Q3, AC4.2.3, contract C16
  - id: BR202.2
    statement: A place's done mark keeps the removed parent's id; the name reads korábbi tag.
    category: policy
    applies_to: [Place]
    trigger: the duties step, every read of a done mark
    logic: The done mark needs both the time and the person, so the duties step does not clear the person. Every read shows the person through C6, which answers korábbi tag for a removed parent (BR204.1). On the later anonymise the parent row itself is anonymised; on delete the place keeps an id that matches no parent and reads korábbi tag.
    violation: Not applicable.
    source: AC3.6.5, contract C6, contract C16
  # --- Coordinators --------------------------------------------------------------------------
  - id: BR203.1
    statement: Removing a group's only coordinator goes ahead, and the administrator is told before and after.
    category: policy
    applies_to: [RemovalPreview, RemovalReport]
    trigger: removal_preview, parent_remove, family_archive
    logic: The working_groups step ends every unrevoked coordinator grant of the removed parents (U4's step, unchanged). Before it runs, the command and the preview list the groups where a removed parent holds the only unrevoked coordinator grant, by group id and name. The confirmation screen shows this list, and the result screen repeats it with a link to each group, where a super admin can appoint a new coordinator.
    violation: Not applicable; nothing is refused.
    source: Q2, contract C16 open point
  # --- How removed people show ----------------------------------------------------------------
  - id: BR204.1
    statement: From the moment of removal a removed parent shows as korábbi tag and a removed family as korábbi család wherever others see history.
    category: policy
    applies_to: [Parent, Family]
    trigger: every read that names a parent or a family through C6
    logic: parent_display_name answers korábbi tag WHEN the parent is archived, or their family is archived or anonymised; otherwise the name. family_display_name answers korábbi család WHEN the family is archived or anonymised; otherwise the name. A link that a step cleared reads korábbi tag or korábbi család through the readers' existing fallbacks. Only the super admin's family record, archive and data-lifecycle screens read the stored name, until the family is deleted or anonymised. No result shows a removed person's phone, email, residence or children.
    violation: Not applicable.
    source: AC3.6.5, Q5, NFR1, NFR11, contract C6
  - id: BR204.2
    statement: An anonymised sign-up's note and an anonymised food offer's note are emptied.
    category: policy
    applies_to: [EventSignup, FoodOffer]
    trigger: the events step
    logic: WHEN the events step clears a sign-up's or a food offer's link to the subject, it also empties the free-text note of that row, because a note can hold a name. The row and its counts stay. This settles U10's open point and extends U10's step.
    violation: Not applicable.
    source: AC3.6.5, AC3.6.6, NFR1, contract C16 (U10 delta)
  # --- Flagged items -------------------------------------------------------------------------
  - id: BR205.1
    statement: Future places, held books, claimed open tasks, family-owned tasks and family-owned schedules of the subject are flagged, not removed.
    category: policy
    applies_to: [FlaggedItem]
    trigger: parent_remove, family_archive
    logic: The flags are set by their owners' steps and stay on their own screens until handled. Duties (BR202.1) and rota weeks and picks (U6) are flagged through the family being inactive. The library step flags held books and returns their loan ids (U13). The to-do step releases a removed parent's claim on an open task and flags the task, and flags a removed family's tasks (U12). The recurring step flags a removed family's schedules (U9). A removed parent alone holds no future places, rota weeks or schedules, so only books and claimed tasks can be flagged for them.
    violation: Not applicable.
    source: AC3.6.2, AC3.6.7, Q6, contract C16
  - id: BR205.2
    statement: After a removal, the result screen lists each flagged item of the subject with a link to where it is handled.
    category: policy
    applies_to: [FlaggedItem]
    trigger: removal_flagged_items
    logic: A super admin reads the flagged items of a removed family (or of a removed parent's family, limited to that parent's held books and released tasks). The read collects them live from the owning areas: flagged future places from the flagged-duties list, held books from the library, flagged tasks from the to-do list, flagged schedules from recurring duties. Each item carries a title, a date where there is one, and the link to its screen. An item an administrator has handled no longer appears. The read returns no person's name.
    violation: Denied refusal for anyone else (BR200.1).
    source: AC3.6.2, AC3.6.7, Q6
  - id: BR205.3
    statement: The confirmation screen shows what a removal would do, per kind of record, without changing anything.
    category: policy
    applies_to: [RemovalPreview]
    trigger: removal_preview
    logic: A super admin reads, for a parent or a family, every step's preview counts in the fixed order, the totals, the groups left without a coordinator (BR203.1) and any refusal the removal would meet (BR200.2). The read writes nothing and locks nothing. The counts can differ from the real run if something changes in between; the run's own counts are the ones audited.
    violation: Denied refusal for anyone else (BR200.1).
    source: Q6, contract C16
  # --- The later delete or anonymise -----------------------------------------------------------
  - id: BR206.1
    statement: The later delete or anonymise keeps today's conditions.
    category: constraint
    applies_to: [LifecycleOutcome, Family]
    trigger: lifecycle_run
    logic: IF the family is not archived, or was archived less than 30 days ago, or has an open hold, or is already anonymised THEN refused with the blockers. IF the administrator has not confirmed THEN refused. The family row is locked first and its version checked (BR200.3).
    violation: Conflict refusal (LIFECYCLE_BLOCKED with blockers, LIFECYCLE_CONFIRMATION_REQUIRED) or LIFECYCLE_STALE.
    source: AC3.6.6, NFR11
  - id: BR206.2
    statement: Before deciding, the later run calls every removal step again for the family.
    category: policy
    applies_to: [RemovalStep, LifecycleOutcome]
    trigger: lifecycle_run
    logic: After the checks of BR206.1 the run calls each step's apply with the family, in the order of BR201.2, so anything that came to point at the family or its parents during the 30 days is cleared too. Steps find most links already cleared and return zero counts.
    violation: The refusal of the step is returned unchanged; nothing is written.
    source: Q8, AC3.6.6
  - id: BR206.3
    statement: A family is anonymised when any record still points at it or its parents after the steps ran; otherwise it is deleted.
    category: calculation
    applies_to: [LifecycleOutcome, Family, FamilyYearStanding]
    trigger: lifecycle_run
    logic: After BR206.2 the run checks every record kind that keeps a family or parent link after removal (places, rota weeks, weekend picks, swap requests, recurring schedules and done marks, family-owned to-do tasks, event sign-ups and offers, library loans and books, checklist claims). IF any row still points at the family or one of its parents THEN anonymise ELSE delete. Its leaving and new standings are deleted in both cases. Past rota weeks and picks keep their rows and read korábbi család.
    violation: Not applicable.
    source: Q4, AC3.6.6, NFR11, contract C16 (U6 delta)
  - id: BR206.4
    statement: Delete removes the family's own records; anonymise replaces every name and keeps the rows.
    category: policy
    applies_to: [Family, Parent, LifecycleOutcome]
    trigger: lifecycle_run
    logic: Both outcomes first delete the family's invitations, pending email changes, profiles and memberships and end any coordinator grant (as today). Delete then removes the parents, children and family rows. Anonymise sets the parents' names to Anonimizált szülő, the children's to Anonimizált gyermek and the family's to Anonimizált család, empties today's contribution notes and change-request reasons of the family's places, and sets anonymizedAt. Either way one audit row lifecycle.delete or lifecycle.anonymize is written with the step counts, and the accounts' authorization versions go up.
    violation: Any failure rolls the whole run back.
    source: AC3.6.6, NFR1, NFR11
  # --- Restoring -------------------------------------------------------------------------------
  - id: BR207.1
    statement: A removed family can still be restored within 30 days; what removal ended does not come back.
    category: policy
    applies_to: [Family, Parent]
    trigger: family_restore
    logic: A super admin restores an archived family that is not anonymised, as today. The family, its parents and children become active and the directory record shows again with empty contact details and no sharing. Sign-ins, memberships, coordinator roles, claims, swaps, notices, return watches and freed places do not return; kept places stop being flagged because the family is active again. The restore screen says this before the button, and each parent needs a new invitation to sign in. A parent removed on their own is not restored.
    violation: Today's refusals of family_restore are unchanged.
    source: Q7, FR3.7
```

## Rules Summary

| Rule | In short |
|---|---|
| BR200.1 | Only a super admin removes, previews, reads flags or runs delete/anonymise |
| BR200.2 | A family's last parent is not removed alone; remove the family |
| BR200.3 | Expected version and idempotency key; outdated screen and repeated click are safe |
| BR201.1 | One transaction, family row locked first, every step applied; any failure rolls back |
| BR201.2 | Fixed step order; working groups before directory |
| BR201.3 | One audit row per removal with counts only |
| BR201.4 | Two removals at once end with one |
| BR202.1 | Manual future places freed; rota, weekend and slot places kept and flagged |
| BR202.2 | Done marks keep the id; the name reads korábbi tag |
| BR203.1 | Removing the only coordinator goes ahead, with a warning before and after |
| BR204.1 | korábbi tag and korábbi család from removal on, except on super admin record screens |
| BR204.2 | Notes of anonymised sign-ups and offers are emptied |
| BR205.1 | Flags stay with their owning areas until handled |
| BR205.2 | Result screen lists each flagged item with a link |
| BR205.3 | Confirmation screen shows per-step counts without changing anything |
| BR206.1 | Delete/anonymise keeps today's conditions (archived, 30 days, no hold, confirmed) |
| BR206.2 | Delete/anonymise runs every step again first |
| BR206.3 | Anonymise if any link remains, else delete; standings deleted either way |
| BR206.4 | What delete removes and what anonymise replaces |
| BR207.1 | Restore within 30 days; ended links do not come back |
