# Business Rules: u6-full-rotas-and-weekend-picks

Built from `unit-of-work.md` (U6), `unit-of-work-story-map.md`, `stories.md` (US4.2, US5.1, US5.3, US6.1, US6.2), `requirements.md`, `components.md`, `contract-summary.md` (C1, C3 to C5, C8 to C12, C16, C18, C20), `decisions.md` and `functional-design-questions.md` (Q1 to Q5). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U2 (BR20 to BR27) still hold unless a rule here says it replaces one. Contains no names or contact details.

All times are Budapest time. For a week whose Monday is M: the weekend is Saturday M+5 and Sunday M+6; "Friday noon" is M+4 at 12:00; picks close when Saturday M+5 begins.

## Rules

```yaml
rules:
  # --- Family standing and the changeover rule ------------------------------------------
  - id: BR60.1
    statement: A super admin marks a family as staying, leaving or new for a school year; unmarked families are staying.
    category: authorization
    applies_to: [FamilyYearStatus]
    trigger: setting a family's standing
    logic: IF the caller is not a super admin THEN refuse. The family must be an active family of the community and the school year one of its years. The caller sends the standing's version (0 when the family has no row yet). The change is audited as family.standing_set with the family id, the year and the standing, and no name.
    violation: Denied, validation (STANDING_INVALID) or conflict (VERSION_CONFLICT) refusal; nothing changes.
    source: FR4.3, contract C2, NFR4, NFR5
  - id: BR60.2
    statement: A leaving family holds no duty from the changeover date on, and a new family holds none before it.
    category: constraint
    applies_to: [FamilyYearStatus, Duty, Place, RotaWeek]
    trigger: family_may_hold_duty(family, date), the read-only function of contract C10
    logic: Not allowed IF the family is not an active family, OR it is leaving in a school year whose changeover date is on or before the date, OR it is new in a school year whose changeover date is after the date. Otherwise allowed. Every row of the family counts, whichever school year the date falls in, so a family that left stays out in later years. The answer carries the code DUTY_INELIGIBLE and a reason (leaving_after_changeover, new_before_changeover or family_inactive).
    violation: The calling command refuses with DUTY_INELIGIBLE and the reason, which the screen shows in plain Hungarian.
    source: FR4.4, AC4.2.1, AC4.2.2, contract C10
  - id: BR60.3
    statement: A rota week belongs to the side of the changeover date on which its Monday falls.
    category: calculation
    applies_to: [RotaWeek, Duty]
    trigger: any eligibility check
    logic: For a rota week, its weekend duties and its pick, the date checked is the week's Monday. For every other duty it is the duty's start date. So a week that contains the changeover date still belongs wholly to the family that may hold its Monday.
    violation: Not applicable; this is a calculation.
    source: FR4.4, AC4.2.1, AC4.2.2
  - id: BR60.4
    statement: The changeover rule is checked wherever a family is given a duty.
    category: constraint
    applies_to: [RotaWeek, Place]
    trigger: making a draft, setting a draft week, publishing, an administrator's manual assignment, sign-up, proposing and accepting a swap, assigning a weekend pick
    logic: Each of these calls BR60.2 for the receiving family and refuses when it is not allowed. The draft does not refuse; it leaves the family out of that week. Later units call the same function for their own sign-ups and changes.
    violation: Validation refusal DUTY_INELIGIBLE with the reason; nothing is saved.
    source: FR4.4, AC4.2.1, AC4.2.2, contract C18
  - id: BR60.5
    statement: Marking a family never removes a duty it already holds; such duties are flagged until an administrator reassigns them.
    category: policy
    applies_to: [FamilyYearStatus, Place, RotaWeek]
    trigger: setting a standing; changing a changeover date; reading the calendar or the plan
    logic: A flagged duty is a future place, or a draft week, whose family is no longer allowed on its date (BR60.2). Flags are computed when read, never stored, so they follow a later change of standing or of the changeover date by themselves. Setting a standing returns the number of flagged duties, and the calendar screen lists them. The family keeps a published duty until it is reassigned (U7). A flagged draft week blocks publishing (BR62.3).
    violation: Not applicable; nothing is refused.
    source: AC4.2.3, owner answer Q5 of user-stories-questions.md
  - id: BR60.6
    statement: Other units read a family's standing and its weeks in the year through two read-only functions.
    category: calculation
    applies_to: [FamilyYearStatus]
    trigger: family_standing(family, year) and families_with_standing(year, standing), contract C20
    logic: family_standing returns the standing and the active weeks. Active weeks count the school weeks of the year - all of them for staying, those whose Monday is before the changeover date for leaving, those from it on for new. An active family with no row is staying. The function returns nothing for an unknown family or year. families_with_standing returns the active families of that standing, unmarked families included under staying.
    violation: Not applicable; read-only and internal.
    source: contract C20, AC5.1.2

  # --- Draft of four rotas -----------------------------------------------------------------
  - id: BR61.1
    statement: A plan holds the four rotas, and each rota has its own duty weeks.
    category: constraint
    applies_to: [RotaPlan, RotaWeek]
    trigger: making a draft
    logic: The draft creates four rows for every school week, one per job. Indoor cleaning and water carrying have a duty in every school week that is not a break week. Front garden and weekend animal care have a duty in every school week, breaks included. This replaces the single indoor-cleaning row of BR21.2.
    violation: Not applicable; this is how the draft is built.
    source: FR5.1, FR5.2, AC5.1.1, AC5.1.4, owner answer Q3 of user-stories-questions.md
  - id: BR61.2
    statement: A week can only go to a family that may hold it, and never to a family that would have indoor cleaning and front garden in the same week.
    category: constraint
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: The candidates for a week are the active families allowed on its Monday (BR60.2). For front garden the family on indoor cleaning that week is not a candidate, and the other way round.
    violation: Not applicable in the draft; a week with no candidate stays empty (BR61.6).
    source: FR5.4, AC5.1.3, AC4.2.1, AC4.2.2
  - id: BR61.3
    statement: Each rota is drafted in turns - the family with the fewest weeks so far goes next.
    category: calculation
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: The rotas are drafted in the order indoor cleaning, front garden, weekend animal care, water carrying, each over its duty weeks in date order. For a week, choose among the candidates (BR61.2) by, in order - (1) the fewest weeks so far in this rota (BR61.4 for a family that joins part-way); (2) a family with no other job in that week (owner answer Q1); (3) the family whose last week in this rota is longest ago, a family with none first; (4) the family order - by name ignoring case, then id, starting at position (calendar year of the school year's start) modulo the number of families. The same families, standings, calendar and year always give the same draft. With only full-year families the indoor-cleaning result equals the draft of BR21.4, which this rule replaces.
    violation: Not applicable; this is a calculation.
    source: FR5.3, AC5.1.2, owner answer Q1, assumption A7
  - id: BR61.4
    statement: A part-year family gets a share in proportion to its weeks.
    category: calculation
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: A leaving family takes turns like everyone else until the changeover date and none after it. A new family takes none before it; at its first possible week its count starts level with the lowest count among the other candidates of that week, so it joins the turns without catching up on the weeks before it arrived.
    violation: Not applicable; this is a calculation.
    source: FR5.3, AC5.1.2, owner answer Q8 of user-stories-questions.md
  - id: BR61.5
    statement: The finished draft is even, and the draft evens itself out before it is shown.
    category: calculation
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: After a rota is drafted, WHILE two full-year families differ by more than one week in it, the latest week of the family with the most that the family with the fewest may take (BR61.2) moves to that family. The result checked by tests - in every rota no two full-year families differ by more than one week; a part-year family's weeks are within one of the full-year average times its share of the year's duty weeks; no family has indoor cleaning and front garden in one week. If the rules leave no week to move, the draft stays as it is and the plan read shows the uneven-count warning (BR62.2).
    violation: Not applicable; this is a calculation.
    source: AC5.1.2, AC5.1.3, owner answer Q8 of user-stories-questions.md
  - id: BR61.6
    statement: A week the draft cannot fill stays empty and says why.
    category: policy
    applies_to: [RotaWeek]
    trigger: making a draft
    logic: IF no active family may hold the week THEN it stays empty with reason no_family. IF families may hold it but each would break the same-week rule THEN it stays empty with reason rule_clash. The planning screen lists the empty weeks with their job and reason. Empty duty weeks block publishing (BR62.3).
    violation: Not applicable.
    source: AC5.1.5

  # --- Adjusting and publishing four rotas -----------------------------------------------
  - id: BR62.1
    statement: An administrator's change to a draft week is refused when it breaks a rota rule, and the refusal names the rule.
    category: validation
    applies_to: [RotaWeek]
    trigger: saving one week of a draft
    logic: The rules of BR22.1, BR22.2 and BR22.4 apply to every rota. In addition - a family on a break week is refused only for indoor cleaning and water carrying (ROTA_BREAK_WEEK); a family not allowed on the week's Monday is refused (DUTY_INELIGIBLE with the reason); a family that holds the other of indoor cleaning and front garden in that week is refused (ROTA_SAME_WEEK_CLASH).
    violation: Validation refusal naming the rule; the change is not saved.
    source: FR5.4, FR5.5, AC5.1.3, AC4.2.1, AC4.2.2
  - id: BR62.2
    statement: Uneven counts and two jobs in one week are warnings, not rules.
    category: policy
    applies_to: [RotaWeek]
    trigger: reading a plan
    logic: The plan read returns, per rota, each family's number of weeks and marks a full-year family more than one week above the lowest full-year count (BR22.3, now per rota). It also lists every week in which one family holds two jobs other than the forbidden pair, as a warning. Saving and publishing never refuse for either.
    violation: Not applicable; nothing is refused.
    source: owner answer Q1, owner answer Q4 of the U2 questions
  - id: BR62.3
    statement: The plan is published as a whole, only when every rota is complete and sound.
    category: validation
    applies_to: [RotaPlan]
    trigger: publishing
    logic: The preconditions of BR23.1 apply to all four rotas at once - refuse IF any duty week of any rota is empty (ROTA_WEEKS_EMPTY), IF a family sits on a break week of indoor cleaning or water carrying (ROTA_BREAK_WEEK), IF a named family is not allowed on its week (ROTA_FAMILY_INELIGIBLE for an inactive family, DUTY_INELIGIBLE for the changeover rule), or IF a family holds indoor cleaning and front garden in one week (ROTA_SAME_WEEK_CLASH). The plan read lists every such week beforehand.
    violation: Validation refusal; the plan stays a draft.
    source: FR5.5, AC5.1.3, AC4.2.1, AC4.2.2
  - id: BR62.4
    statement: Publishing creates the duties of all four rotas in one step.
    category: calculation
    applies_to: [RotaPlan, Duty, Place, WeekendSlot]
    trigger: publishing
    logic: Indoor cleaning, front garden and water carrying weeks each become one weekly duty with one place for the family, as in BR23.2, titled "Belső takarítás", "Előkert" and "Vízhordás". A weekend animal care week becomes five WeekendSlot rows and their five duties (BR63.1), each with one place for the weekend family. Everything commits together or not at all; BR23.3 and BR23.5 hold unchanged.
    violation: The whole step rolls back; the plan stays a draft.
    source: FR5.1, FR6.1, AC5.1.1, AC6.1.1
  - id: BR62.5
    statement: The publishing notice goes through the notification function, so it also arrives by email.
    category: policy
    applies_to: [RotaPlan]
    trigger: publishing
    logic: The notice of BR23.4 is sent with notice_send (contract C8) instead of being written directly - one per active parent with an account of each family on the plan, kind rota_published, once per plan and parent. Its text lists that family's weeks for each rota and says that an indoor-cleaning or front-garden week also needs a weekend pick. It names no other family.
    violation: A refusal by notice_send rolls the publishing back; a failed email does not (contract C8).
    source: FR17.1, AC5.2.3, contract C8, NFR10
  - id: BR62.6
    statement: A plan made before this unit gets the three new rotas as empty weeks.
    category: policy
    applies_to: [RotaPlan, RotaWeek]
    trigger: installing this unit's database change
    logic: Every existing plan gets rows for front garden, water carrying and weekend animal care with reason not_drafted. A draft can be filled by hand or discarded and drafted again. A plan already published keeps its indoor-cleaning duties; its new weeks have no duty and cannot be filled in this unit, like a removed break week (BR20.5). On the owner's computer the local database is reset instead.
    violation: Not applicable.
    source: owner answer Q5

  # --- Weekend duties and picks ------------------------------------------------------------
  - id: BR63.1
    statement: Every weekend has five duties - two openings, two closings and one shelter cleaning.
    category: constraint
    applies_to: [WeekendSlot, Duty]
    trigger: publishing
    logic: The slots are Saturday opening, Saturday closing, Sunday opening, Sunday closing and shelter cleaning. Each is one duty of origin weekend_slot with one place. They exist for every school week, break weeks included.
    violation: Not applicable.
    source: FR6.1, AC6.1.1
  - id: BR63.2
    statement: The weekend family holds every weekend duty that nobody has picked.
    category: policy
    applies_to: [Place, WeekendSlot]
    trigger: publishing; removing or changing a pick; a picking family being absent
    logic: At publishing all five places go to the weekend animal-care family. A pick moves one opening or closing to the picking family; undoing or changing a pick gives the slot back. So at any moment the weekend family holds the shelter cleaning and whatever the others did not take - two openings or closings once both have picked, three in a break week, more while a pick is missing.
    violation: Not applicable.
    source: FR6.3, AC6.1.1, AC6.1.2, AC6.1.3
  - id: BR63.3
    statement: The families on indoor cleaning and front garden each owe one pick for their week's weekend.
    category: constraint
    applies_to: [WeekendPick, RotaWeek]
    trigger: publishing; any read of a weekend
    logic: A published indoor-cleaning or front-garden week with a family owes one pick. A break week has no indoor-cleaning family, so only the front-garden family picks. A week with no family owes nothing and its slot stays with the weekend family. A picking family that is also that week's weekend family owes nothing (owner answer Q1). A week whose weekend had already started when the plan was published owes nothing.
    violation: Not applicable; an owed pick that is not made is chased (BR64.1, BR64.2).
    source: FR6.2, AC6.1.1, AC6.1.2, AC6.1.3, owner answer Q1
  - id: BR63.4
    statement: A parent of the picking family picks one free opening or closing of that weekend.
    category: authorization
    applies_to: [WeekendPick, Place]
    trigger: picking a slot
    logic: The caller must be a parent of the family of that picking week; anyone else is denied. The slot must be an opening or closing of the same week (the shelter cleaning and another weekend's slots give WEEKEND_SLOT_NOT_PICKABLE), still held by the weekend family (otherwise WEEKEND_SLOT_TAKEN), in a week that owes a pick (otherwise WEEKEND_PICK_NOT_NEEDED), before picks close (otherwise WEEKEND_PICK_CLOSED). The pick is recorded with source family and the slot's place moves to the picking family with source weekend_pick, in one step.
    violation: Denied, validation or conflict refusal; nothing changes.
    source: FR6.2, AC6.1.1, AC6.1.5
  - id: BR63.5
    statement: A family may change its pick until Friday noon, and may still make a first pick until the weekend starts.
    category: constraint
    applies_to: [WeekendPick]
    trigger: picking when a pick already exists; picking late
    logic: IF the week already has a pick and it is before Friday noon THEN the old slot goes back to the weekend family and the new one is taken, in one step; picking the same slot again changes nothing. IF it is Friday noon or later THEN a change is refused with WEEKEND_PICK_LOCKED. A week with no pick can still be picked until Saturday begins.
    violation: Conflict refusal (WEEKEND_PICK_LOCKED or WEEKEND_PICK_CLOSED); the pick stays.
    source: owner answers Q2 and Q3
  - id: BR63.6
    statement: A super admin can assign or change a family's pick until the weekend starts.
    category: authorization
    applies_to: [WeekendPick, Place]
    trigger: assigning a slot from the unpicked list
    logic: Only a super admin. The same slot rules as BR63.4 apply, at any time before Saturday begins, Friday noon included. The pick is recorded with source administrator, audited as weekend_pick.assign with the week and slot and no name, and the family's parents get the notice weekend_pick_assigned.
    violation: Denied, validation or conflict refusal; nothing changes.
    source: FR6.4, AC6.2.2, owner answers Q2 and Q3, NFR4
  - id: BR63.7
    statement: Two families taking the same slot at once get the same result as one after the other.
    category: constraint
    applies_to: [WeekendPick, Place]
    trigger: picking, changing or assigning a pick
    logic: Each of these locks, in the C1 order, both families, the picking week, the pick, the slot's duty and its place, and compares the version of the chosen slot's place with the one the screen sent. The loser of a race, or a screen that is out of date, gets WEEKEND_SLOT_TAKEN and the refreshed list to pick again. A repeated call with the same idempotency key returns the stored result.
    violation: Conflict refusal (WEEKEND_SLOT_TAKEN); nothing changes.
    source: AC6.1.4, NFR5, contract C1
  - id: BR63.8
    statement: A pick nobody made by the start of the weekend is missed, and the weekend family does that slot too.
    category: policy
    applies_to: [WeekendPick]
    trigger: Saturday begins with an owed pick still open
    logic: Nothing is changed or assigned by the app. The weekend family already holds every slot not taken (BR63.2). The picking week shows as missed on the administrator's unpicked list for the rest of the school year.
    violation: Not applicable.
    source: owner answer Q3, FR6.5
  - id: BR63.9
    statement: A pick and the place of its slot always agree.
    category: constraint
    applies_to: [WeekendPick, Place]
    trigger: every function that writes a pick or moves a weekend place
    logic: A slot with a pick is held by the family of the picking week; a slot without one is held by the weekend family. The place says who holds the duty; the pick only links it to the picking week. Both are always written in the same step. Moving the place uses the internal place_reassign of contract C5, which this unit's pick functions may call for weekend-slot places only.
    violation: The step rolls back.
    source: ADR-004, contract C5

  # --- Chasing and reminders -----------------------------------------------------------------
  - id: BR64.1
    statement: A family that has not picked is reminded once, from the Wednesday before the weekend.
    category: policy
    applies_to: [WeekendPick]
    trigger: the daily run, check weekend_picks_reminder
    logic: IF it is Wednesday of the week or later, picks are not yet closed, and a week owes a pick that has not been made THEN the active parents of that family get the notice weekend_pick_reminder, linking to their duty card, once per picking week. A family that has picked gets nothing.
    violation: Not applicable; a failing check is recorded by the run (contract C9).
    source: FR6.4, AC6.2.1, AC6.2.3
  - id: BR64.2
    statement: From Friday noon the administrators are told about each family that still has not picked.
    category: policy
    applies_to: [WeekendPick]
    trigger: the Friday-noon run, check weekend_picks_alert
    logic: IF it is Friday noon of the week or later, the week has not ended, and an owed pick has not been made THEN every super admin who has a parent record gets the notice weekend_pick_overdue once per picking week, linking to the unpicked list. The list itself shows the week to every super admin, with or without the notice.
    violation: Not applicable.
    source: FR6.4, AC6.2.2
  - id: BR64.3
    statement: When a picking family is missing, the weekend family and the administrators are told once.
    category: policy
    applies_to: [RotaWeek, WeekendSlot]
    trigger: the daily run, check weekend_picks_reminder
    logic: IF it is Wednesday of the week or later, the weekend has not started, and the week's front-garden row has no family, or it is not a break week and its indoor-cleaning row has no family THEN the weekend family's parents get weekend_slot_returned and the super admins with a parent record get weekend_picker_missing, once per week and job. The slot already lies with the weekend family (BR63.2).
    violation: Not applicable.
    source: AC6.1.3
  - id: BR64.4
    statement: Each family is reminded once on the Friday before its rota week.
    category: policy
    applies_to: [Duty, Place]
    trigger: the daily run, check rota_week_reminder
    logic: IF it is the Friday before a week's Monday or later, and the week has not started THEN the parents of the family holding that week's indoor-cleaning, front-garden or water-carrying duty, and of the family holding its shelter cleaning, get the notice rota_week_reminder naming the job and the week, once per duty. This is the rota reminder that BR23.6 left open.
    violation: Not applicable.
    source: owner answer Q4, FR17.1, FR17.3
  - id: BR64.5
    statement: Every check of this unit is safe to run twice and sends each notice once.
    category: constraint
    applies_to: [TimedCheck]
    trigger: the daily and Friday-noon runs
    logic: Each check takes the moment of the run, reads published plans only, sends through notice_send with a once key built from the kind and the week or duty, and returns how many notices it created and skipped. A run made late still sends what is due and not yet sent; a second run sends nothing. The checks are registered in the run's registry by this unit and are not callable by signed-in users.
    violation: A check that fails is recorded and the others still run (contract C9).
    source: contract C9, AC17.1.3, ADR-006
  - id: BR64.6
    statement: The notices of this unit name the job, the week and the slot, and nobody else's details.
    category: policy
    applies_to: [NoticeKind]
    trigger: building a notice or its email
    logic: The text is built for the reading parent from the duty - job, week dates, slot, and for the administrator kinds the family name. It never holds a phone number, an email address or a child's name.
    violation: Not applicable.
    source: NFR10, AC17.1.4, FR5.6

  # --- What people see ---------------------------------------------------------------------
  - id: BR65.1
    statement: Everyone signed in sees all four rotas and the weekend duties by family name.
    category: authorization
    applies_to: [RotaPlan, RotaWeek, WeekendSlot, Place]
    trigger: opening the overview
    logic: BR24.1 holds for the whole plan - for each school week the overview returns the family of each of the four rotas and the family holding each of the five weekend duties, with the break flag and the caller's own family marked. Published plans only.
    violation: Denied refusal for a caller with no right to read the community.
    source: FR8.1, FR5.6, FR6.5
  - id: BR65.2
    statement: A duty card says what the job is, and what belongs to it in that week.
    category: policy
    applies_to: [Duty]
    trigger: opening a duty card
    logic: BR24.2 holds for every rota and weekend duty. The card of a weekly duty says there is no fixed day. A front-garden card includes watering IF the week's Monday is in March to October, and not otherwise. A water-carrying card says to fill all the bottles at the end of the week. A weekend-duty card names its day and whether it is the morning opening, the evening closing or the shelter cleaning. The database returns the job and these facts; the screen holds the Hungarian text.
    violation: Denied refusal for anyone but the holding family and super admins.
    source: FR5.7, FR5.8, FR5.9, AC5.3.1, AC5.3.2, AC5.3.3
  - id: BR65.3
    statement: The families of a weekend and the administrators see who has picked what, and who has not.
    category: authorization
    applies_to: [WeekendPick, WeekendSlot]
    trigger: opening the weekend part of a duty card; the unpicked list
    logic: The card of a picking week and the card of a weekend duty carry the weekend's state - the five slots with their holders, which picking family has not picked yet, and, for a picking family, which slots are free and until when it may pick or change. It is returned to parents of the week's indoor-cleaning, front-garden and weekend families and to super admins. Everyone else sees only the holders, through the overview.
    violation: Denied refusal.
    source: FR6.5, AC6.1.1
  - id: BR65.4
    statement: Only super admins read family standings, flagged duties and the unpicked list.
    category: authorization
    applies_to: [FamilyYearStatus, WeekendPick]
    trigger: opening the calendar screen, the planning screen or the unpicked list
    logic: The calendar read returns each active family's standing for the year and the flagged duties (BR60.5). The unpicked list returns, from the current week on, every owed pick not yet made with its free slots, and the missed picks of the school year (BR63.8). Every other role gets a denied refusal, never an empty list.
    violation: Denied refusal.
    source: FR6.5, AC4.2.3, AC6.2.2, contract C1
  - id: BR65.5
    statement: Rota and weekend duties are not offered for sign-up, and today's change functions refuse them.
    category: constraint
    applies_to: [Duty, Place]
    trigger: today's sign-up list, task forms, and the functions named in BR25.1
    logic: BR24.4 and BR25.1 apply to duties of origin weekend_slot exactly as to rota_week. Until U7, a weekend place changes holder only through a pick.
    violation: Conflict refusal (DUTY_ROTA_MANAGED).
    source: ADR-002, ADR-011

  # --- What later units rely on --------------------------------------------------------------
  - id: BR66.1
    statement: A change to rota duties is checked against the same-week rule before it is applied.
    category: constraint
    applies_to: [RotaWeek, Place]
    trigger: rota_check_change(changes), called by the swaps and duty changes work (contract C11)
    logic: Given places and the families that would hold them, it answers not allowed with ROTA_SAME_WEEK_CLASH IF, after all the changes together, a family would hold indoor cleaning and front garden in one week. It is read-only, internal, and looks at nothing else; eligibility is the caller's check (BR60.2).
    violation: The caller refuses its command.
    source: contract C11, FR5.4, ADR-011
  - id: BR66.2
    statement: After a rota duty changes hands, the plan and the weekend follow it.
    category: calculation
    applies_to: [RotaWeek, WeekendPick, Place]
    trigger: rota_adjust_picks_after_change(changes), called in the same step as the change (contract C11)
    logic: For each changed place the rota week takes the new family. For a picking week with a pick - IF the new family is not that week's weekend family and picks have not closed THEN the slot's place moves to the new family and the pick stays; otherwise the pick is removed, the slot returns to the weekend family, and the new family is asked to pick when it still owes one. For a weekend family's week, named by its shelter-cleaning place - every weekend place the old family still held moves to the new family, and a pick the new family had for that weekend is removed because it no longer owes one. It returns the number of picks reopened. Internal only.
    violation: The caller's whole step rolls back.
    source: contract C11, ADR-011
  - id: BR66.3
    statement: Other units ask which family is on a rota week.
    category: calculation
    applies_to: [RotaWeek]
    trigger: rota_family_for(job, week), contract C12
    logic: Returns the family of that job's row for that Monday in a published plan, or nothing when there is no published week or it has no family. Internal and read-only.
    violation: Not applicable.
    source: contract C12
  - id: BR66.4
    statement: Removing a family reports its future rota weeks and picks as flagged, and changes none of them.
    category: policy
    applies_to: [RotaWeek, WeekendPick]
    trigger: the removal preview and apply functions of contract C16, called by the removal work
    logic: For a family, both return the number of its future rota weeks and picks as to_flag and nothing to clear; a removed family is no longer allowed on any date, so those duties show as flagged by BR60.5 with no further write. For a parent both return zero, because this unit stores no person. Past rows stay and show through the display-name function.
    violation: Not applicable.
    source: contract C16

  # --- Every new function and table ----------------------------------------------------------
  - id: BR67.1
    statement: Every new function follows the shared function convention.
    category: constraint
    applies_to: [all functions of this unit]
    trigger: creating any function
    logic: As BR27.1. The signed-in commands of this unit are setting a standing, picking a slot and assigning a pick; the changed ones are the draft, set-week and publish commands. The eligibility, standing, rota-rule, rota-week and removal functions and the three checks are internal and granted to no signed-in account.
    violation: A function that skips the convention fails the schema tests.
    source: contract C1, NFR3
  - id: BR67.2
    statement: New tables are read only through functions, and new list values are registered by this unit.
    category: authorization
    applies_to: [FamilyYearStatus, WeekendSlot, WeekendPick]
    trigger: any direct table access; installing this unit's database change
    logic: Application roles hold select only, as in BR27.2, and none on standings, which only super admins may read. This unit's own database change adds its notice kinds, its three checks, the audit actions family.standing_set and weekend_pick.assign, the duty origin weekend_slot and the place source weekend_pick; no function of U2 or U5 is edited for them beyond the rota functions this unit owns.
    violation: A direct write is refused by the database.
    source: NFR3, contract C8, contract C9, team.md (Code Style)
```

## Rules Summary

| Group | Rules | What they decide |
|---|---|---|
| Family standing | BR60.1 to BR60.6 | Marking leaving and new families, the changeover rule, where it is checked, flagged duties, what other units read |
| Draft | BR61.1 to BR61.6 | Four rotas, who may get a week, taking turns, part-year shares, evening out, empty weeks |
| Adjust and publish | BR62.1 to BR62.6 | Refusals and warnings, publishing all four, the duties created, the notice, older plans |
| Weekend picks | BR63.1 to BR63.9 | Five duties, the weekend family's default, who picks, picking, changing, assigning, races, missed picks |
| Chasing | BR64.1 to BR64.6 | Wednesday reminder, Friday-noon alert, missing picker, rota-week reminder, safe repeats, content |
| Seeing | BR65.1 to BR65.5 | Overview, duty cards, weekend state, administrator lists, protection |
| For later units | BR66.1 to BR66.4 | Rota-rule check, following a duty change, family on a week, removal |
| Every function | BR67.1, BR67.2 | Function convention, table access, registered values |
