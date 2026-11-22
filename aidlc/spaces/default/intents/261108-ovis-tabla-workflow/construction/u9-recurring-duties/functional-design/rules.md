# Business Rules: u9-recurring-duties

Built from `unit-of-work.md` (U9), `unit-of-work-story-map.md`, `stories.md` (US9.1 to US9.4, US17.1), `requirements.md` (FR1.6, FR2.3, FR9, FR17, A5, NFR3 to NFR5, NFR10), `components.md`, `contract-summary.md` (C1 to C3, C6 to C9, C12, C14, C16), `decisions.md` and `functional-design-questions.md` (Q1 to Q7). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about scope and reach still hold. Contains no names or contact details.

All dates and times are Budapest time. A schedule's *owner people* are: for a group, its active members and coordinators; for a family, its parents; for a rota job, the parents of the family that holds the occurrence's rota week at that moment.

## Rules

```yaml
rules:
  # --- Who sets up schedules ---------------------------------------------------------------
  - id: BR141.1
    statement: A coordinator sets up and changes the schedules of their own group, a super admin sets up all schedules, and nobody else sets up any.
    category: authorization
    applies_to: [RecurringSchedule]
    trigger: recurring_schedule_save, recurring_schedule_set_active
    logic: IF ownerKind is group THEN the caller must be a super admin or a coordinator of that group (can_manage_group, C2). IF ownerKind is family or rota_week THEN the caller must be a super admin. A parent, a teacher, a coordinator of another group and a caller with no active session are refused. A group of another community answers as if it did not exist.
    violation: Denied refusal (authorization_denied); nothing changes.
    source: FR9.1, FR2.3, AC9.1.3, Q3
  - id: BR141.2
    statement: A changed schedule must still match what the caller saw, and a repeated press changes nothing more.
    category: validation
    applies_to: [RecurringSchedule]
    trigger: recurring_schedule_save, recurring_schedule_set_active
    logic: A save of an existing schedule sends its version and a different version is refused. Every command sends an idempotency key and a repeated key returns the stored result. The schedule row is locked first, then the occurrences it changes by ascending id (C1).
    violation: Conflict refusal (VERSION_CONFLICT); nothing changes.
    source: contract C1, NFR3
  # --- What a schedule is --------------------------------------------------------------------
  - id: BR142.1
    statement: A schedule has a title, a category, an interval and a start.
    category: validation
    applies_to: [RecurringSchedule]
    trigger: recurring_schedule_save
    logic: The title is 1 to 200 characters after trimming and the category 1 to 100. intervalCount is a whole number from 1 to 52. startDate is required and may be in the past or the future.
    violation: Validation refusal on the field.
    source: FR9.1, AC9.1.1
  - id: BR142.2
    statement: A season limits a schedule to a range of months.
    category: constraint
    applies_to: [RecurringSchedule]
    trigger: recurring_schedule_save
    logic: seasonFromMonth and seasonToMonth are both empty (all year) or both set, each 1 to 12, with the from month not after the to month. A season does not wrap over New Year; a job that runs from November to February is two schedules or all year.
    violation: Validation refusal on season (invalid).
    source: AC9.1.2, FR9.6
  - id: BR142.3
    statement: A schedule has exactly one owner, and the owner matches its kind.
    category: constraint
    applies_to: [RecurringSchedule]
    trigger: recurring_schedule_save
    logic: IF ownerKind is group THEN workingGroupId is set, belongs to an active working group of the community, and familyId and rotaJob are empty. IF family THEN familyId is set, names an active family of the community, and the others are empty. IF rota_week THEN rotaJob is set and the others are empty. intervalKind rota_weeks is allowed only with rota_week. The owner of an existing schedule cannot change; the schedule is switched off and a new one made.
    violation: Validation refusal on owner (invalid, archived or locked).
    source: FR9.1, Q3
  # --- When occurrences exist --------------------------------------------------------------
  - id: BR143.1
    statement: Due dates come from the schedule alone, never from the last done mark.
    category: calculation
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_due_check
    logic: For intervalKind weeks the due dates are startDate, then startDate plus the interval in whole weeks, again and again. An occurrence marked done late or never does not move any other due date. A due date outside the season (BR142.2) has no occurrence, and the later due dates are unchanged.
    violation: not applicable; a calculation.
    source: AC9.1.1, AC9.1.2, Q2
  - id: BR143.2
    statement: A rota-week schedule counts the published weeks of its rota job.
    category: calculation
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_due_check
    logic: The weeks of the job in the published rota of the school year are put in date order and numbered from 1 for the first week on or after startDate. Break weeks have no rota rows and so do not count. A week is due when its number minus 1 divides by intervalCount, so with an interval of 4 the 1st, 5th and 9th water weeks are due. The due date is that week's Monday and the occurrence stores the rota week. A week with no family (C12 returns null) gets no occurrence. Each published plan is one school year, so the count restarts at 1 with the first published water week of a new school year's plan; the owner confirmed this reading on 2026-11-22.
    violation: not applicable; a calculation.
    source: FR9.3, AC9.3.1, Q5, contract C12
  - id: BR143.3
    statement: An occurrence appears 14 days before its due date.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: recurring_due_check
    logic: The daily check creates the occurrence of every active schedule whose due date is from today up to 14 days ahead and that does not exist yet. Creating the same occurrence again creates nothing (one per schedule and due date). Due dates in the past that never got an occurrence are not created.
    violation: not applicable; a policy.
    source: AC9.1.1, Q1
  - id: BR143.4
    statement: A schedule whose owner is gone creates nothing.
    category: constraint
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_due_check
    logic: IF a family-owned schedule's family is removed or anonymised THEN no further occurrence is created. IF a group-owned schedule's group is archived THEN no further occurrence is created. A group-owned schedule keeps running when its last coordinator leaves; the super admins then manage it (BR151.2). Occurrences that already exist are not deleted.
    violation: not applicable; a constraint.
    source: Q7, FR9.1
  - id: BR143.5
    statement: The daily check can run twice on one day without doing anything twice.
    category: constraint
    applies_to: [RecurringOccurrence]
    trigger: recurring_due_check
    logic: recurring_due_check(now) returns created and skipped counts, registers as a daily check with U5's registry in this unit's own migration, and a failure inside it is recorded and does not stop the other checks (C9). A second run on the same day creates no occurrence and sends no notice.
    violation: not applicable; a constraint.
    source: FR17.3, contract C9, AC17.1.3
  - id: BR144.1
    statement: Changing a schedule applies from the next occurrence that nobody has acted on.
    category: policy
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_schedule_save
    logic: Saving a change to the interval, start, season or title removes the occurrences of that schedule whose due date is after today, that are open, and that have sent no notice, and the next daily run creates them again by the new rule. Occurrences that are due today or earlier, done, skipped or already noticed stay as they are. A change to the title or category only updates the schedule, and the occurrences show the new title.
    violation: not applicable; a policy.
    source: AC9.3.2, FR9.3, A5
  - id: BR144.2
    statement: Switching a schedule off stops it, and switching it on restarts it.
    category: policy
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_schedule_set_active
    logic: Switching off skips the open occurrences due after today with the reason "kikapcsolva" and the caller as the person, and creates no new ones. Occurrences due today or earlier stay open. Switching on again lets the daily run create occurrences by the schedule from today on. The rabbit items of the starting list are switched off (BR148.1).
    violation: Denied or conflict refusal as BR141.1 and BR141.2.
    source: FR9.4, AC9.4.1
  # --- Done marks and skipping ---------------------------------------------------------------
  - id: BR145.1
    statement: Only the people responsible for a duty can mark it done.
    category: authorization
    applies_to: [RecurringOccurrence]
    trigger: recurring_occurrence_mark_done
    logic: IF the schedule is group-owned THEN the caller must be an active member or coordinator of that group (C7). IF it is family-owned THEN the caller's family must be that family. IF it is rota-week-owned THEN the caller's family must be the family that holds the occurrence's rota week now (C12). A teacher, a parent of another family or group and a caller with no family refuse. A super admin who is none of these refuses too.
    violation: Denied refusal (authorization_denied); screen text "Ezt a feladatot csak a felelős jelölheti késznek."
    source: AC9.2.1, AC9.2.2, FR9.2, Q4
  - id: BR145.2
    statement: A done mark records who and when, once.
    category: constraint
    applies_to: [RecurringOccurrence]
    trigger: recurring_occurrence_mark_done
    logic: The caller sends the occurrence's version. Marking an open occurrence sets status done, doneByParentId to the caller and doneAt to now, and raises the version. A second press with the same key returns the stored result; a different caller or a stale screen on an occurrence that is already done gets a conflict. A skipped occurrence cannot be marked done (RECURRING_CLOSED). An occurrence may be marked done from the day it appears, including before its due date.
    violation: Conflict refusal (VERSION_CONFLICT) or RECURRING_CLOSED; nothing changes.
    source: AC9.2.1, FR9.2, ADR-003
  - id: BR145.3
    statement: A done mark can be taken back within 24 hours.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: recurring_occurrence_undo_done
    logic: The person who marked it, or a coordinator of the group (for a group-owned schedule) or a super admin, can set a done occurrence back to open while less than 24 hours have passed since doneAt. After that it is refused. Undoing clears doneByParentId and doneAt. Marking and undoing are audited without names.
    violation: Denied refusal, or conflict refusal RECURRING_UNDO_TOO_LATE; nothing changes.
    source: AC9.2.1, Q4
  - id: BR146.1
    statement: A missed occurrence stays visible as overdue until someone deals with it.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: reads
    logic: An open occurrence whose due date is before today is shown as "lejárt" (overdue) in the owner's list. It stays open until it is marked done or skipped. It does not move any other due date (BR143.1).
    violation: not applicable; a policy.
    source: Q2, AC9.1.1
  - id: BR146.2
    statement: A manager can close an occurrence as skipped, with a reason.
    category: authorization
    applies_to: [RecurringOccurrence]
    trigger: recurring_occurrence_skip
    logic: IF the schedule is group-owned THEN a coordinator of that group or a super admin may skip. Otherwise only a super admin may. The reason is required, 1 to 200 characters. Only an open occurrence can be skipped. A skipped occurrence shows "kihagyva" with the reason and cannot be reopened; a new due date comes from the schedule.
    violation: Denied, validation (reason) or conflict refusal.
    source: Q2, FR9.1
  - id: BR146.3
    statement: Old overdue occurrences move out of the way.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: reads
    logic: An open occurrence more than 60 days overdue is no longer in the owner's current list or counts; it is shown only in the history list of the schedule. Nothing is deleted.
    violation: not applicable; a policy.
    source: Q2
  # --- Bottle cleaning -------------------------------------------------------------------------
  - id: BR147.1
    statement: Bottle cleaning is a rota-week schedule on the water-carrying job, every fourth water week by default.
    category: policy
    applies_to: [RecurringSchedule]
    trigger: install, recurring_schedule_save
    logic: A fresh install holds one schedule titled "Palackok tisztítása" with ownerKind rota_week, rotaJob water_carrying, intervalKind rota_weeks, intervalCount 4. Its interval is changed by a super admin (BR141.1), from the school calendar page, which shows the number. A change applies as BR144.1 says. The assistant's recommendation of four is an assumption the owner can change (A5).
    violation: Denied refusal as BR141.1.
    source: FR9.3, AC9.3.1, AC9.3.2, A5
  - id: BR147.2
    statement: The family on a water week sees its cleaning duty on its duty card, and it follows the water week.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: reads
    logic: For a water duty whose rota week has an occurrence, the duty card shows a "Palackok tisztítása" line with the Kész button of BR145. The responsible family is read live from the rota week (C12), so after a swap, cancellation or reassignment of that week the new holder sees and may mark it, and the old holder no longer can. No row of this unit is written by a swap.
    violation: not applicable; a policy.
    source: AC9.3.1, Q5
  # --- The starting list --------------------------------------------------------------------------
  - id: BR148.1
    statement: A fresh install holds the Animal Care group's periodic care, with the rabbit items off.
    category: policy
    applies_to: [RecurringSchedule]
    trigger: install
    logic: The starting data holds six group-owned schedules of the Animal Care group, three of them rabbit items with isActive false and category "nyúl". The titles and intervals are invented test data in Hungarian; the owner replaces them in the app. A coordinator of the group changes the interval or switches a rabbit item on (BR141.1, BR144.2).
    violation: not applicable; starting data.
    source: FR9.4, AC9.4.1, Q6
  - id: BR148.2
    statement: The playground and maintenance groups each have an inspection round whose interval they set.
    category: policy
    applies_to: [RecurringSchedule]
    trigger: install
    logic: The starting data holds one group-owned schedule each for the playground group and the maintenance group, every 4 weeks by default. Each group's coordinators change the interval (BR141.1).
    violation: not applicable; starting data.
    source: FR9.5, AC9.4.2, Q6
  - id: BR148.3
    statement: The seasonal jobs are recurring duties, not to-do tasks.
    category: policy
    applies_to: [RecurringSchedule]
    trigger: install
    logic: The starting data holds mowing, weeding and turning the compost as recurring schedules with seasons (mowing every 2 weeks from April to October, weeding every 3 weeks from April to September, compost every 6 weeks from March to November) and none of them as a to-do task. The migration of the to-do list (U15) does not load them as tasks; that is U15's rule and is noted here only.
    violation: not applicable; starting data.
    source: FR9.6, AC9.4.3, Q6
  # --- Notices -----------------------------------------------------------------------------------------
  - id: BR149.1
    statement: A due duty tells its owner people, and an overdue one tells them again once.
    category: policy
    applies_to: [RecurringOccurrence]
    trigger: recurring_due_check
    logic: On the due date the daily run sends one notice and email "Esedékes: [cím]" with kind recurring_due. If the occurrence is still open 3 days after its due date it sends one "Lejárt: [cím]" with kind recurring_overdue, but only while it is at most 60 days past its due date, the same limit after which screens treat it as history (BR146.3); the owner set this cap on 2026-11-22. For a group-owned schedule the recipients are the group's coordinators; for a family or rota-week schedule they are the parents of the owning family. Each is sent once, with once keys built from the schedule and the due date, through notice_send (C8), and a failed email never fails the check. A done or skipped occurrence sends nothing. Nothing is sent for a family or group with no recipients.
    violation: not applicable; a policy.
    source: AC17.1.1, AC17.1.3, FR17.4, Q1, contract C8
  - id: BR149.2
    statement: A notice about a recurring duty links to it and tells nothing about other families.
    category: constraint
    applies_to: [RecurringOccurrence]
    trigger: notice facts, notice_send
    logic: Each notice has target type recurring_duty and opens the occurrence page of the owner's list. Its text is the title and the due date only. It never lists the people on the list, another family or any contact detail.
    violation: not applicable; a constraint.
    source: AC17.1.4, AC17.1.6, NFR10
  # --- Reading ------------------------------------------------------------------------------------------
  - id: BR150.1
    statement: Group duties are readable by everyone signed in, and family duties by their family.
    category: authorization
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_list_for_group, recurring_my_occurrences, recurring_occurrence_get
    logic: Every signed-in reader, teachers included, reads the schedules and occurrences of a working group, because the group page is community-wide (FR1.6). Family-owned and rota-week-owned occurrences are read by the parents of the owning family and by super admins only. The name of whoever marked a duty done is shown through C6. A caller with no access gets the denied refusal, never an empty list. Teachers see no done, skip or manage control.
    violation: Denied refusal (authorization_denied).
    source: FR1.6, FR9.2, NFR3, contract C6
  - id: BR150.2
    statement: The coordinator page gets the group's recurring duties.
    category: authorization
    applies_to: [RecurringSchedule]
    trigger: recurring_list(group_id)
    logic: recurring_list(group_id) returns rows of id, title and status (active, switched off) for that group's schedules and is answered only to a caller for whom can_manage_group is true; anyone else gets the C1 denied refusal.
    violation: Denied refusal.
    source: contract C14, FR2.3
  # --- Removal and display ---------------------------------------------------------------------------
  - id: BR151.1
    statement: Removing a family flags its schedules and occurrences and deletes nothing.
    category: policy
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: recurring_duties_removal_preview, recurring_duties_removal_apply
    logic: For subject kind family the preview and the apply return to_clear 0 and to_flag equal to the count of that family's family-owned schedules plus its open occurrences, rota-week-owned ones included. The apply writes nothing; the flag is the family's status read by the screens. For subject kind parent the apply clears doneByParentId and skippedByParentId of that parent on occurrences (counted in to_clear) and keeps doneAt; the screens then show "korábbi tag" through C6. Both functions are internal and never granted to a signed-in user. They count the same rows in preview and apply.
    violation: not applicable; internal.
    source: contract C16, Q7
  - id: BR151.2
    statement: A group's schedules keep being managed when its coordinator leaves.
    category: constraint
    applies_to: [RecurringSchedule]
    trigger: group coordinator change
    logic: Nothing in this unit depends on one named coordinator. When the group has no coordinator, can_manage_group is true for super admins only, so only they set up and change its schedules (BR141.1), and the notice of BR149.1 goes to the group's members instead.
    violation: not applicable; a constraint.
    source: Q7, ADR-010
  # --- Audit and technical ---------------------------------------------------------------------------
  - id: BR152.1
    statement: Changes are audited without names.
    category: constraint
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: every command
    logic: Saving, switching on or off, marking done, undoing and skipping write an audit row with the actor's id, the kind of change and the record id, and no title text, person name or contact detail. The actor id is never rewritten on removal.
    violation: not applicable; a constraint.
    source: NFR4, NFR5, contract C1
  - id: BR152.2
    statement: Every command takes the locks in the common order and checks the six fixed cases.
    category: constraint
    applies_to: [RecurringSchedule, RecurringOccurrence]
    trigger: every command
    logic: A command locks the schedule row first and then occurrence rows by ascending id. It starts with revoke all and an explicit grant execute, refuses through U3R00 and returns the C1 envelope. Each rule has the six cases agreed in U1: allowed, refused, out of reach, outdated screen, repeated click and two people at once, with "nem értelmezhető" and a reason where a case has no meaning (a read, an internal function).
    violation: not applicable; a convention.
    source: contract C1, NFR3, team.md
```

## Summary

| Question | Answer | Rule |
|---|---|---|
| Who sets up schedules? | Group coordinator for their group, super admin for all; parents never | BR141.1 |
| What decides the next due date? | The schedule only, never the last done mark | BR143.1 |
| What counts as the fourth water week? | The fourth published water week; break weeks do not count | BR143.2 |
| When does an occurrence appear? | 14 days before it is due | BR143.3 |
| Who may mark it done? | The group's members and coordinators, or the owning family | BR145.1 |
| Can it be taken back? | For 24 hours | BR145.3 |
| What if nobody marks it? | Overdue until done or skipped; history after 60 days | BR146.1, BR146.3 |
| Who may skip? | Group coordinator or super admin (group); super admin (others) | BR146.2 |
| Bottle cleaning | Every 4th water week, follows the water week | BR147.1, BR147.2 |
| Who is told? | Owner people, on the due date and 3 days after, once each | BR149.1 |
| On removal | Flagged, nothing deleted; done and skip names cleared | BR151.1 |
