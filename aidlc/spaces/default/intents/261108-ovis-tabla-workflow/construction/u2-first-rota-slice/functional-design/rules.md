# Business Rules: u2-first-rota-slice

Built from `unit-of-work.md` (U2), `unit-of-work-story-map.md`, `stories.md` (US4.1, US5.1 to US5.3, US8.1), `requirements.md`, `components.md`, `contract-summary.md` (C1 to C6, C18), `decisions.md` and `functional-design-questions.md` (Q1 to Q6). Every rule is enforced on the database side. Screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. Contains no names or contact details.

## Rules

```yaml
rules:
  # --- School calendar -------------------------------------------------------------
  - id: BR20.1
    statement: A break week is the Monday of a school week of its school year, recorded once.
    category: validation
    applies_to: [BreakWeek]
    trigger: adding a break week
    logic: IF the date is not a Monday, or is not the Monday of a school week of that year, or the year already has that break week THEN refuse. The label is optional text up to 100 characters.
    violation: Validation refusal naming the date field (BREAK_WEEK_INVALID or BREAK_WEEK_EXISTS); nothing is stored.
    source: FR4.1, AC4.1.1
  - id: BR20.2
    statement: Only a super admin changes the school calendar.
    category: authorization
    applies_to: [SchoolYear, BreakWeek]
    trigger: adding or removing a break week, changing the changeover date
    logic: IF the caller is not a super admin of the community THEN refuse. A parent, teacher or working-group admin is refused whatever they send.
    violation: Denied refusal; nothing changes.
    source: contract C2, NFR3
  - id: BR20.3
    statement: Every school year has a changeover date, 1 July of the year it ends by default, which a super admin can change.
    category: constraint
    applies_to: [SchoolYear]
    trigger: creating or editing a school year
    logic: IF no changeover date is given THEN it is 1 July of the calendar year of endsOn. IF a date is given THEN it must not be before startsOn. Existing years get the default when the structure changes.
    violation: Validation refusal naming the changeover field.
    source: FR4.2, AC4.1.2
  - id: BR20.4
    statement: Every rota reads a break week as a week with no duty, and reads the calendar through the C3 functions.
    category: policy
    applies_to: [BreakWeek, RotaWeek]
    trigger: drafting, editing or publishing a rota; the overview
    logic: school_weeks(year) returns every school week with a flag saying whether it is a break week. A duty week is a school week that is not a break week. The rota's duty weeks are never stored; they are read from the calendar each time.
    violation: Not applicable; this is a read rule.
    source: FR4.1, AC4.1.1, AC5.1.4
  - id: BR20.5
    statement: Break weeks can be added or removed after a rota is published; a published duty already in a new break week stays and is shown with a warning.
    category: policy
    applies_to: [BreakWeek, Duty]
    trigger: adding or removing a break week while a plan exists
    logic: Adding or removing never changes a published duty or a plan row. The plan read and the overview mark a filled week that is now a break week, and the administrator's calendar screen lists such weeks as a warning. A removed break week becomes an empty duty week: on a draft it blocks publishing until filled, on a published plan it stays without a duty until U7 can add one.
    violation: Not applicable; nothing is refused.
    source: AC4.1.1, owner answer Q6 (B)

  # --- Draft ------------------------------------------------------------------------
  - id: BR21.1
    statement: A school year has at most one rota plan, and only a super admin makes a draft.
    category: constraint
    applies_to: [RotaPlan]
    trigger: asking for a draft
    logic: IF the caller is not a super admin THEN refuse. IF the year already has a plan, draft or published, THEN refuse with ROTA_PLAN_EXISTS and keep the plan. Otherwise create the plan as a draft and its weeks (BR21.2).
    violation: Denied or conflict refusal (ROTA_PLAN_EXISTS); nothing changes. The owner chose this over replacing the draft (Q2).
    source: FR5.1, AC5.1.1, owner answer Q2 (A)
  - id: BR21.2
    statement: A plan holds one row for every school week, and every duty week gets one family.
    category: constraint
    applies_to: [RotaPlan, RotaWeek]
    trigger: making a draft
    logic: The draft creates one indoor-cleaning row for every school week. A duty week row names one family. A break week row stays empty. There is one family per row, so no week has two.
    violation: Not applicable; this is how the draft is built. Rows are never removed except by discarding the plan. Because the rows follow the school year's dates, changing the year's start or end date while a plan exists is refused with ROTA_PLAN_EXISTS; discard the draft first.
    source: FR5.1, FR5.2, AC5.1.1, AC5.1.4
  - id: BR21.3
    statement: The draft uses the active families of the community; weeks it cannot fill stay empty with a reason.
    category: policy
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: Families are those of the community with status active. IF there are none THEN every duty week stays empty with reason no_family and the screen shows the reason. This unit does not know leaving or new families (U6), so every active family counts for the whole year.
    violation: Not applicable; empty weeks block publishing (BR23.1).
    source: FR5.3, AC5.1.5
  - id: BR21.4
    statement: The draft is even, spread out and repeatable.
    category: calculation
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: Order the families by family name ignoring case, then by id. Number the duty weeks in date order from 0. Let N be the number of families and offset the calendar year of startsOn modulo N. Duty week i gets the family at position (i + offset) modulo N. So a family's turns are N duty weeks apart, no two families differ by more than one week, and the same families, calendar and year always give the same draft. A break week does not advance the cycle.
    violation: Not applicable; this is a calculation. The even-count check is part of the test of the draft.
    source: FR5.3, AC5.1.2, owner answer Q1 (A), assumption A7
  - id: BR21.5
    statement: A draft is discarded, never replaced, and the discard says how many hand changes it loses.
    category: constraint
    applies_to: [RotaPlan, RotaWeek]
    trigger: discarding a draft
    logic: Only a super admin, only a draft, only with the plan's current version. The caller sends the number of hand-changed weeks the screen showed (the rows with changedByAdmin). IF that differs from the current number THEN refuse with ROTA_DISCARD_OUTDATED, so the administrator sees the real number. A published plan is refused with ROTA_PLAN_PUBLISHED. A discard removes the plan and all its rows, and is audited.
    violation: Conflict or invalidated refusal; nothing is removed.
    source: owner answer Q2 (A), NFR4, NFR5

  # --- Adjusting --------------------------------------------------------------------
  - id: BR22.1
    statement: An administrator sets a week to an active family of the community, or empties it.
    category: validation
    applies_to: [RotaWeek]
    trigger: saving one week of a draft
    logic: Only a super admin, only on a draft plan. The family must be an active family of the community, or empty. Setting a family clears the empty reason; emptying sets reason cleared. Either marks the row changedByAdmin. The caller sends the row's version.
    violation: Denied, validation (ROTA_FAMILY_INELIGIBLE) or invalidated refusal naming the rule; the change is not saved.
    source: FR5.5, AC5.2.2
  - id: BR22.2
    statement: A family cannot be put on a break week.
    category: constraint
    applies_to: [RotaWeek, BreakWeek]
    trigger: saving one week of a draft; publishing
    logic: IF the week is a break week now (BR20.4) and a family is named THEN refuse with ROTA_BREAK_WEEK.
    violation: Validation refusal naming the rule in plain words; the change is not saved.
    source: FR5.2, AC5.2.2, AC5.1.4
  - id: BR22.3
    statement: Evenness is a warning, not a rule, when a week is changed by hand.
    category: policy
    applies_to: [RotaWeek]
    trigger: reading a plan
    logic: The plan read returns each family's number of weeks and marks a family more than one week above the lowest count among the families. Saving never refuses for evenness.
    violation: Not applicable; nothing is refused.
    source: owner answer Q4 (A)
  - id: BR22.4
    statement: Two administrators editing the same week get the same result as editing one after the other.
    category: constraint
    applies_to: [RotaWeek, RotaPlan]
    trigger: saving a week, discarding, publishing
    logic: Every change takes, as the first lock of the rota week step, the plan row and then the week rows in ascending id order (the C1 lock order; the plan row's place is a note for C1), and compares the version sent with the stored one. A stale version gets VERSION_CONFLICT. A repeated call with the same idempotency key returns the stored result and changes nothing.
    violation: Conflict refusal (VERSION_CONFLICT); nothing changes.
    source: NFR5
  - id: BR22.5
    statement: A draft is invisible to everyone but a super admin.
    category: authorization
    applies_to: [RotaPlan, RotaWeek]
    trigger: any read of a plan or its weeks
    logic: A draft plan and its rows are read only through the planning functions, which refuse a caller who is not a super admin. The overview and the duty card read only published plans. A parent, teacher or working-group admin never receives a draft, not as a row, a count or a hint.
    violation: Denied refusal for the planning functions; the overview returns the "nothing published" state.
    source: FR5.5, AC5.2.1, NFR3

  # --- Publishing -------------------------------------------------------------------
  - id: BR23.1
    statement: A draft is published only when it is complete and sound.
    category: validation
    applies_to: [RotaPlan]
    trigger: publishing
    logic: Only a super admin, only a draft, only with the plan's current version. Refuse IF any duty week is empty (ROTA_WEEKS_EMPTY, with the weeks listed by the plan read), IF a family is named on a break week (ROTA_BREAK_WEEK), or IF a named family is no longer active (ROTA_FAMILY_INELIGIBLE). All are checked on the state at the time of publishing.
    violation: Validation or invalidated refusal; the plan stays a draft.
    source: FR5.5, AC5.2.3, owner answer Q3 (A)
  - id: BR23.2
    statement: Publishing turns every filled week into a duty with one place, in one step.
    category: calculation
    applies_to: [RotaPlan, Duty, Place]
    trigger: publishing
    logic: For each row with a family, in ascending week order, create the duty through duty_create (BR26.1) with origin rota_week and the row id, title "Belső takarítás", category rota_indoor_cleaning, no working group, one place for the family with source rota_publish. Then set the plan to published with the time and the account. All of it commits together or not at all.
    violation: The whole step rolls back; the plan stays a draft.
    source: FR5.5, AC5.2.3
  - id: BR23.3
    statement: Publishing twice does not publish twice.
    category: constraint
    applies_to: [RotaPlan]
    trigger: a repeated click, a second administrator
    logic: A repeated key returns the stored result. A published plan asked to publish again with another key is refused with ROTA_PLAN_PUBLISHED and creates nothing. Two administrators publishing at once: the second waits on the plan row and then gets that refusal.
    violation: Conflict refusal; no duplicate duty or place.
    source: NFR5
  - id: BR23.4
    statement: Each family on the rota is told its own weeks, and nobody else is told.
    category: policy
    applies_to: [RotaNotice]
    trigger: publishing
    logic: For each family with at least one week, one in-app notice per active parent with an account, with kind rota_published and the plan as the target. The text lists that family's weeks only. Families with no week get nothing. A family with no linked parent gets nothing and is not told later. The unit sends no email (U6).
    violation: A failure to write a notice rolls the publishing back.
    source: AC5.2.3, FR17.1, owner answer Q5 (A)
  - id: BR23.5
    statement: Publishing and discarding a draft are recorded in the audit log.
    category: policy
    applies_to: [RotaPlan]
    trigger: publishing, discarding
    logic: The audit event rota.publish records the plan, the school year and the number of duties created. The event rota.discard records the plan and the number of weeks that had been changed by hand. Neither holds a family or person name.
    violation: A failure to write the event rolls the step back.
    source: AC5.2.3, NFR4
  - id: BR23.6
    statement: Rota duties get no automatic 7-day or 24-hour reminder in this unit.
    category: policy
    applies_to: [Duty]
    trigger: publishing
    logic: duty_create does not plan the reminders that today's sign-up and assignment functions plan. Reminders for duty weeks, if wanted, arrive with the daily run (U5) and the rota checks (U6).
    violation: Not applicable.
    source: contract C4, ADR-006

  # --- What parents and teachers see ---------------------------------------------------
  - id: BR24.1
    statement: Everyone signed in can read the published rota by family name; a draft never shows.
    category: authorization
    applies_to: [RotaPlan, RotaWeek, Duty]
    trigger: opening the overview
    logic: The overview returns the school weeks of the year with each week's break flag and, for each filled week of a published plan, the family display name (C6). It marks the caller's own family, none for a teacher. It never returns a child's name, a contact detail or a sharing choice, and the sharing choice plays no part. IF no plan is published THEN it returns the state nothing_published, which is not a refusal and not an empty list. A caller who is not signed in is denied.
    violation: Denied refusal for a caller with no right to read the community.
    source: FR8.1, FR5.6, AC8.1.1, AC8.1.2, assumption A2
  - id: BR24.2
    statement: A duty card shows the family, the week and the instructions, and says there is no fixed day.
    category: authorization
    applies_to: [Duty, Place]
    trigger: opening a duty card
    logic: The card is returned to a parent of the holding family and to a super admin; any other caller, or a made-up id, gets the same denied refusal. It carries the job, the family display name, the Monday and Sunday of the week, a flag noFixedDay true, and whether the week is now a break week (the warning of BR20.5). A teacher and a parent of another family are denied.
    violation: Denied refusal; nothing is returned.
    source: FR5.6, FR5.7, AC5.3.1
  - id: BR24.3
    statement: The instruction text of an indoor-cleaning card is fixed in the app, and the other rotas' texts come later.
    category: policy
    applies_to: [Duty]
    trigger: showing a duty card
    logic: The app shows its Hungarian text for the job on the card: that the family cleans the kindergarten's indoor rooms during the week and that there is no fixed day. The database returns the job and the screen picks the text. The front-garden watering text (March to October) and the water-carrying text belong to U6.
    violation: Not applicable.
    source: FR5.7, AC5.3.1
  - id: BR24.4
    statement: A rota duty is not offered for sign-up and is not edited as a task.
    category: policy
    applies_to: [Duty]
    trigger: today's sign-up list, the schedule, the administrator's task list and task form
    logic: A duty whose originKind is rota_week is left out of duty_list and the administrator's task forms. It is found through the overview and the card. The teacher's schedule shows it as a normal entry with the family name only.
    violation: Not applicable.
    source: ADR-002, FR5.6

  # --- Protection of rota duties until U7 -----------------------------------------------
  - id: BR25.1
    statement: Until swaps and duty changes arrive, today's change functions refuse a rota duty.
    category: constraint
    applies_to: [Duty, Place]
    trigger: task save, assigning, removing a place, sign-up, swap or cancellation request, deciding a request, archiving a family that holds a place
    logic: IF the duty's originKind is rota_week THEN the function refuses with DUTY_ROTA_MANAGED and changes nothing. A parent's card shows no swap or cancellation buttons for a rota duty. U7 lifts this rule when it moves those functions into DutyChanges.
    violation: Conflict refusal (DUTY_ROTA_MANAGED).
    source: ADR-011, contract C5

  # --- Shared duty model (contracts C4, C5, C18) -------------------------------------
  - id: BR26.1
    statement: duty_create makes a duty and its places, and a repeat returns the same ones.
    category: constraint
    applies_to: [Duty, Place]
    trigger: a function of another component creating duties
    logic: Internal only. Input as in C4. IF a duty with the same origin already exists THEN return it with its places and create nothing. The capacity is the number of places named; a null entry is an open place and creates no place row. It does not check eligibility; the caller does (C10 once U6 exists) and, for the rota, publishing has already checked.
    violation: A made-up origin or a malformed place list rolls the caller back.
    source: contract C4, NFR5
  - id: BR26.2
    statement: A place is marked done once, by its family or its group's coordinator.
    category: authorization
    applies_to: [Place]
    trigger: place_mark_done
    logic: Allowed for a parent of the holding family, or a coordinator of the duty's working group. IF the caller is anyone else, including a super admin with no family and a duty with no group, THEN denied. IF the place is already done THEN return success and keep the first who and when. A cancelled or closed duty gives DUTY_CLOSED. A stale version gives VERSION_CONFLICT. A duty that has passed may still be marked done. This unit has no screen for it; U9 delivers US9.2.
    violation: Denied, conflict or invalidated refusal; nothing changes.
    source: contract C18, FR9.2, NFR5
  - id: BR26.3
    statement: Changing who holds a place is done by three internal functions, and a duty that has passed cannot change.
    category: constraint
    applies_to: [Place]
    trigger: place_exchange, place_reassign, place_release, called from DutyChanges only (U7)
    logic: place_exchange gives each of two places to the other's family. place_reassign gives a place to another family. place_release ends a place so its seat is open again. Each takes the place version and refuses a stale one with VERSION_CONFLICT, a duty that has passed or is closed with DUTY_CLOSED, and a family that already holds a place on that duty with DUTY_ALREADY_ASSIGNED. They are not granted to signed-in accounts, check no eligibility and write no audit (the caller does both).
    violation: The caller's whole transaction rolls back.
    source: contract C5, ADR-011

  # --- Every new function --------------------------------------------------------------
  - id: BR27.1
    statement: Every new function follows the shared function convention.
    category: constraint
    applies_to: [all functions of this unit]
    trigger: creating any function
    logic: Start with revoke all, then an explicit grant execute to the roles that may call it (internal functions to none). Pin the search path. Check the active session first, then the idempotency key, then the caller's right, then change data in one block, then store the result. A signed-in command returns the C1 envelope; a list function returns rows or a denied refusal, never an empty list for a caller with no access. Business refusals go through U3R00 and roll back.
    violation: A function that skips the convention fails the schema tests.
    source: contract C1, NFR3
  - id: BR27.2
    statement: New tables let application roles read only what they may, and nothing writes them directly.
    category: authorization
    applies_to: [BreakWeek, RotaPlan, RotaWeek]
    trigger: any direct table access
    logic: Application roles hold select only, and never on the rows a draft rota holds for anyone but a super admin. Every change goes through a named function.
    violation: A direct write is refused by the database.
    source: NFR3, team.md (Code Style)
```

## Rules Summary

| Group | Rules | What they decide |
|---|---|---|
| School calendar | BR20.1 to BR20.5 | Break weeks, changeover date, who may change them, late changes |
| Draft | BR21.1 to BR21.5 | One plan per year, one family per week, the even draft, discarding |
| Adjusting | BR22.1 to BR22.5 | Setting a week, break weeks, evenness warning, two at once, hidden drafts |
| Publishing | BR23.1 to BR23.6 | Preconditions, duties and places, repeats, notices, audit, no old reminders |
| Seeing | BR24.1 to BR24.4 | Overview, duty card, fixed text, what is hidden from sign-up lists |
| Protection | BR25.1 | Today's change functions refuse rota duties until U7 |
| Shared duty model | BR26.1 to BR26.3 | duty_create, done mark, place changes |
| Every function | BR27.1, BR27.2 | The function convention and table access |
