# Business Rules: u8-animal-care-and-information

Built from `unit-of-work.md` (U8), `unit-of-work-story-map.md`, `stories.md` (US7.1 to US7.3, US10.1, US10.2), `requirements.md` (FR4.4, FR7.1 to FR7.6, FR10.1 to FR10.5, FR17.1, FR17.3, NFR3, NFR5, NFR10), `components.md` (AnimalCareSignup, DutyChanges, Information, TimedChecks, WebApplication), `contract-summary.md` (C1, C3, C4, C5, C7, C8, C9, C10, C18, C19, C20), `decisions.md` (ADR-012) and `functional-design-questions.md` (Q1 to Q8). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. U1's reach rules, U2's place rules, U6's changeover rule (C10) and U7's swap rules still hold. Contains no names or contact details.

All times are Budapest time. A *slot* is a duty of origin `animal_slot`; it *starts* at its start time (entities.md, AnimalSlot). A slot is *free* when it has no active place and *taken* when it has one. A *super admin* is a caller with super scope in the community; the *administrator* of AC7.3.2 is every super admin.

## Rules

```yaml
rules:
  # --- The year's slots ---------------------------------------------------------------------------
  - id: BR80.1
    statement: Only a super admin sets a school year's slot times and alert group and creates its slots.
    category: authorization
    applies_to: [SlotCalendar, AnimalSlot]
    trigger: animal_calendar_save, animal_slots_create
    logic: The caller needs an active session and super scope in the community. A working-group admin, a parent and a teacher are refused and learn nothing about the calendar.
    violation: Denied refusal (authorization_denied).
    source: FR7.1, NFR3, Q1, Q2
  - id: BR80.2
    statement: A school year has a morning and an afternoon slot on every weekday of its weeks, school breaks included, each held by at most one family.
    category: constraint
    applies_to: [AnimalSlot, Duty]
    trigger: animal_slots_create
    logic: FOR every week the year has (C3 school_weeks, break weeks included) and every Monday to Friday in it, there is one morning and one afternoon AnimalSlot, each the origin of one duty of capacity one (C4 duty_create, origin animal_slot, no working group, no family named). Creating a slot makes no place; the place is made when a family signs up (BR81.2) and released when it gives the slot up (BR82.5). Saturdays and Sundays get no slot; weekend care is U6's rota.
    violation: Not applicable; the shape is produced by the creation.
    source: FR7.1, AC7.1.1, Q2
  - id: BR80.3
    statement: Creating the slots again only adds the days that are missing.
    category: constraint
    applies_to: [AnimalSlot]
    trigger: animal_slots_create
    logic: IF a slot for the date and part already exists, THEN it is left as it is, with its family; only missing slots are created, for example after the school year gained weeks. Creating never deletes or moves a slot. The result reports how many slots were added. Two super admins pressing at the same moment get one set of slots (unique date and part per calendar, C4's same-origin rule).
    violation: Not applicable; a repeat succeeds and adds nothing.
    source: Q2, NFR5
  - id: BR80.4
    statement: The start times can be changed, and a change moves only the slots from tomorrow on.
    category: policy
    applies_to: [SlotCalendar, Duty]
    trigger: animal_calendar_save
    logic: The morning time must be earlier than the afternoon time. IF the times change, THEN every slot dated after today gets its new start and end time; today's and earlier slots keep theirs. The holding families stay, and each family holding at least one moved slot gets one notice saying the new time, keyed by the calendar and its new version so a repeated save sends nothing more (C8). A time change can bring a slot inside the 24-hour limit of BR82.3; that is accepted.
    violation: Validation refusal ANIMAL_TIMES_INVALID when the morning is not earlier than the afternoon; conflict refusal VERSION_CONFLICT on a stale screen.
    source: Q1, FR7.1
  - id: BR80.5
    statement: The day-before alert goes to the coordinators of the year's alert group, which starts as the Állatgondozás group.
    category: policy
    applies_to: [SlotCalendar]
    trigger: animal_calendar_save, first creation of the calendar
    logic: When the calendar is first made, its alert group is the school year's working group named Állatgondozás, if there is one. A super admin may change it to another group of the same year or clear it; with none, only the super admins are alerted (BR85.4).
    violation: Validation refusal ANIMAL_GROUP_INVALID for a group of another year or community.
    source: FR7.5, AC7.3.2
  # --- Signing up ---------------------------------------------------------------------------------
  - id: BR81.1
    statement: A parent signs their own family up for a free slot when the family may hold a duty on that day.
    category: authorization
    applies_to: [Place]
    trigger: duty_sign_up (C18) on a slot
    logic: The caller needs an active session and a current family; a teacher or an admin with no family is refused. The family must be allowed to hold a duty on the slot's date (C10 family_may_hold_duty, the changeover rule of FR4.4), otherwise the sign-up is refused with the reason the screen shows.
    violation: Denied refusal for a caller with no family; validation refusal DUTY_INELIGIBLE with the changeover reason.
    source: FR7.2, FR4.4, AC7.1.1, AC7.1.3, contract C10, contract C18
  - id: BR81.2
    statement: Signing up for a free slot makes the family hold it.
    category: policy
    applies_to: [Place]
    trigger: duty_sign_up on a free slot that has not started
    logic: IF the slot is free and has not started, THEN the caller's family gets its place, the family's count rises at once and the slot is no longer listed as empty. A repeated click with the same key returns the first result and creates nothing more (C1).
    violation: Not applicable; the successful path.
    source: FR7.2, AC7.1.1, NFR5
  - id: BR81.3
    statement: A taken slot cannot be signed up for.
    category: constraint
    applies_to: [Place]
    trigger: duty_sign_up on a taken slot
    logic: IF the slot already has an active place, THEN the sign-up is refused and the screen says it is taken ("Már foglalt"). When two families sign up for the same free slot at the same moment, the duty row lock lets the first through and the second gets this refusal. A family that already holds the slot gets the already-assigned refusal.
    violation: Conflict refusal DUTY_FULL (or DUTY_ALREADY_ASSIGNED for the holding family); DUTY_VERSION_STALE for an outdated screen.
    source: AC7.1.2, NFR5
  - id: BR81.4
    statement: A slot that has started cannot be signed up for.
    category: constraint
    applies_to: [Place]
    trigger: duty_sign_up on a started slot
    logic: IF the slot's start time has passed, THEN the sign-up is refused. The page offers no button for it.
    violation: Conflict refusal DUTY_CLOSED.
    source: FR7.2, contract C18
  - id: BR81.5
    statement: A family may hold any number of slots, including both slots of one day.
    category: policy
    applies_to: [Place]
    trigger: duty_sign_up on a slot
    logic: No limit per family, per day or per week is applied. Fair share is shown and reminded, never enforced (FR7.4).
    violation: Not applicable.
    source: FR7.4, FR7.6
  - id: BR81.6
    statement: Every signed-in member of the community sees the slots and which family holds each.
    category: authorization
    applies_to: [AnimalSlot, Place]
    trigger: animal_slots_list
    logic: Parents, teachers and admins of the community read the slots of a school year with the holding family's name (assumption A2 in requirements.md). No contact details are returned. Only a parent of a current family gets sign-up and give-up actions; a teacher reads the same list on a read-only page.
    violation: Denied refusal for a caller outside the community.
    source: FR7.3, FR8.1, NFR3
  - id: BR81.7
    statement: The teacher schedule leaves out the daily animal-care slots; teachers read them on their own read-only page.
    category: policy
    applies_to: [AnimalSlot]
    trigger: schedule_get; the page /teacher/allatok
    logic: The daily slots number about 440 a year and would bury the tasks and events of the schedule (FR8.1 lists the community's tasks and events, and the slots are listed by animal_slots_list instead). schedule_get therefore leaves out tasks whose origin is an animal slot. A teacher reads the same slots, with the holding family's name, on the read-only page /teacher/allatok (BR81.6); that page has no sign-up, give-up or swap control.
    violation: Not applicable; a presentation rule.
    source: FR8.1, owner decision after review
  # --- Giving up a slot (C19, ADR-012) ------------------------------------------------------------
  - id: BR82.1
    statement: Only a parent of the family that holds a slot can give it up.
    category: authorization
    applies_to: [Place]
    trigger: slot_give_up
    logic: The caller needs an active session and must be a parent of the family holding the place. An administrator, a coordinator or another family is refused and learns nothing about the place.
    violation: Denied refusal (authorization_denied).
    source: ADR-012, contract C19
  - id: BR82.2
    statement: Only an animal-care slot can be given up this way.
    category: constraint
    applies_to: [Place]
    trigger: slot_give_up
    logic: IF the place's duty does not have origin animal_slot, THEN it is refused; every other duty is cancelled only through an administrator's decision (U7, assumption A6).
    violation: Conflict refusal SLOT_NOT_RELEASABLE.
    source: ADR-012, assumption A6, contract C19
  - id: BR82.3
    statement: A slot can be given up until 24 hours before it starts; after that the family can only swap it.
    category: constraint
    applies_to: [Place]
    trigger: slot_give_up
    logic: IF now is 24 hours or less before the slot's start time, THEN giving up is refused, and the page offers only Csere (U7 swap). The limit is checked in the database at the moment of the call, not on the screen.
    violation: Conflict refusal SLOT_GIVE_UP_TOO_LATE; DUTY_CLOSED once the slot has started.
    source: ADR-012, refined-mockups Q5, contract C19
  - id: BR82.4
    statement: A slot in an open swap cannot be given up.
    category: constraint
    applies_to: [Place]
    trigger: slot_give_up
    logic: IF the place is the source or target of an open swap, THEN giving up is refused; the family first withdraws or the other family declines (U7 BR71.3).
    violation: Conflict refusal REQUEST_CONFLICT.
    source: contract C19, U7 BR71.3
  - id: BR82.5
    statement: Giving up frees the slot at once and lowers the family's count.
    category: policy
    applies_to: [Place]
    trigger: slot_give_up allowed by BR82.1 to BR82.4
    logic: The place is released (C5 place_release), so the slot is free for anyone and is listed as empty by the next daily check. The screen's version must match, otherwise the call is refused. A repeated click with the same key returns the first result. Nobody is notified; the daily check of BR85 covers the free slot. The duty reminders of the family are re-planned (reminder_plan), so no reminder is sent for the released slot.
    violation: Conflict refusal VERSION_CONFLICT for an outdated screen.
    source: ADR-012, contract C19, NFR5
  # --- Fair share ---------------------------------------------------------------------------------
  - id: BR83.1
    statement: A family's count is the number of slots it holds in the school year, past and coming.
    category: calculation
    applies_to: [Place, AnimalSlot]
    trigger: animal_fair_share, animal_fair_share_check
    logic: COUNT the active places of the family on slots of the school year, whatever their date (Q3). A slot given up no longer counts. Only animal-care slots count; no other duty does (FR7.3).
    violation: Not applicable; a calculation.
    source: FR7.3, AC7.2.1, Q3
  - id: BR83.2
    statement: The families counted are every active family of the community, each for its active weeks in the school year.
    category: calculation
    applies_to: [Family]
    trigger: animal_fair_share, animal_fair_share_check
    logic: A family counts when it is active and has at least one active week in the year. Its standing comes from C20, and a family with no standing row for the year is staying, as C20 and families_with_standing treat it today. Active weeks are all weeks for staying, the weeks before the changeover for leaving, and the weeks from it for new.
    violation: Not applicable; a calculation.
    source: AC7.2.1, contract C20
  - id: BR83.3
    statement: The average is for a family present all year, and each family's own share is in proportion to its weeks.
    category: calculation
    applies_to: [Family]
    trigger: animal_fair_share, animal_fair_share_check
    logic: LET T be the slots held in the year by counted families, W the number of weeks of the year, and S the sum of the counted families' active weeks. The average is T times W divided by S. A family's own share is T times its active weeks divided by S. With no counted family or no held slot, the average and every share are zero. A family is below its share when its count is less than its share.
    violation: Not applicable; a calculation.
    source: AC7.2.1, Q3
  - id: BR83.4
    statement: The page shows every counted family's count beside its own share, and the average.
    category: policy
    applies_to: [Family]
    trigger: animal_fair_share
    logic: Shares and the average are shown with one decimal (Hungarian decimal comma); comparisons use the exact value. Families are listed by family name, the caller's own family first. Any signed-in member of the community may read it (BR81.6).
    violation: Not applicable; a read.
    source: AC7.2.1, FR7.3
  - id: BR83.5
    statement: Being below the share never blocks anything.
    category: policy
    applies_to: [Family]
    trigger: every command of this unit
    logic: No command checks the fair share. It only feeds the panel and the reminder.
    violation: Not applicable.
    source: FR7.4, AC7.2.2
  # --- Fair-share reminder ------------------------------------------------------------------------
  - id: BR84.1
    statement: Fair-share reminders are worked out once a month, on the first weekday of the month.
    category: policy
    applies_to: [FairShareRound]
    trigger: animal_fair_share_check in the daily run
    logic: IF the run's Budapest date is on or after the first Monday-to-Friday day of its month, the date falls in a week of the school year, and no FairShareRound exists for the year and month, THEN the round is worked out now and recorded; otherwise the check does nothing. So a run missed on the first weekday is made up by the next run that month, and a second run on the same day does nothing.
    violation: Not applicable; a timed check.
    source: AC7.2.2, Q4, FR17.3, contract C9
  - id: BR84.2
    statement: In a round, every counted family below its share gets one reminder.
    category: policy
    applies_to: [Family]
    trigger: the monthly round of BR84.1
    logic: FOR each family counted (BR83.2) whose count is below its share (BR83.3) on the round's day and which may hold a duty on that day (C10), send one fair-share reminder to each of its parents with an account (C8, in-app and email, FR17.1). The reminder says the family's count and share and links to the sign-up page; it names no other family's contact details (NFR10).
    violation: Not applicable.
    source: AC7.2.2, FR7.4, FR17.1, NFR10
  - id: BR84.3
    statement: A family gets at most one fair-share reminder a month.
    category: constraint
    applies_to: [Family]
    trigger: the monthly round of BR84.1
    logic: The send-once key names the family, the school year and the month, so a repeated round or a repeated run never sends a second one (C8 once_key).
    violation: Not applicable; a duplicate is not created.
    source: AC7.2.2, NFR5
  - id: BR84.4
    statement: A family at or above its share gets no reminder.
    category: policy
    applies_to: [Family]
    trigger: the monthly round of BR84.1
    logic: IF the family's count is equal to or more than its share, THEN nothing is sent to it.
    violation: Not applicable.
    source: AC7.2.3
  # --- Empty-slot warnings ------------------------------------------------------------------------
  - id: BR85.1
    statement: Each day the check lists the free slots of the next three calendar days.
    category: policy
    applies_to: [AnimalSlot]
    trigger: animal_empty_slots_check in the daily run
    logic: For a run on Budapest date D, the listed slots are the free slots dated D+1, D+2 or D+3 (Q5). On a Friday that is Monday only; the Saturday run lists Monday and Tuesday, and the Sunday run lists Monday, Tuesday and Wednesday. A slot dated before its school year's first day is never listed, because the run reads the calendar of the year that contains day D.
    violation: Not applicable; a timed check.
    source: FR7.5, AC7.3.1, Q5
  - id: BR85.2
    statement: Each family is told about the listed slots it may hold.
    category: policy
    applies_to: [Family]
    trigger: animal_empty_slots_check
    logic: FOR each active family (with no standing row counted as staying, BR83.2), keep the listed slots on whose date it may hold a duty (C10); IF any remain, THEN send one message to each of its parents with an account, listing those slots by day and part and linking to the sign-up page (C8, in-app and email). The message names no family's contact details (NFR10).
    violation: Not applicable.
    source: FR7.5, AC7.3.1, FR17.1, NFR10
  - id: BR85.3
    statement: A family gets at most one empty-slot message a day.
    category: constraint
    applies_to: [Family]
    trigger: animal_empty_slots_check
    logic: The send-once key names the family and the run's date, so a second run on the same day sends nothing more.
    violation: Not applicable; a duplicate is not created.
    source: AC7.3.1, NFR5
  - id: BR85.4
    statement: A slot still free the day before also alerts the super admins and the alert group's coordinators.
    category: policy
    applies_to: [AnimalSlot]
    trigger: animal_empty_slots_check
    logic: IF free slots are dated D+1, THEN every super admin with a parent record and every active coordinator of the calendar's alert group (C7 group_coordinators) gets one alert that day listing them, keyed by the run's date. Someone who is both gets it once.
    violation: Not applicable.
    source: FR7.5, AC7.3.2
  - id: BR85.5
    statement: A slot filled before the check is not listed.
    category: policy
    applies_to: [AnimalSlot]
    trigger: animal_empty_slots_check
    logic: The check reads the slots at the moment it runs; a slot with an active place is not free and is not listed. A message already sent is not withdrawn when the slot is filled later that day.
    violation: Not applicable.
    source: AC7.3.3
  - id: BR85.6
    statement: Both checks are safe to run twice and never fail the daily run.
    category: constraint
    applies_to: [FairShareRound, AnimalSlot]
    trigger: the daily run (C9)
    logic: Each check is a registered daily check returning how many messages it created and skipped. Running it twice on the same day creates nothing more (BR84.1, BR84.3, BR85.3). A check with no calendar for the day's school year does nothing. A failure is recorded by the daily run and the other checks still run (C9).
    violation: Not applicable.
    source: FR17.3, contract C9
  # --- The information page -----------------------------------------------------------------------
  - id: BR86.1
    statement: Every signed-in member of the community reads the visible sections.
    category: authorization
    applies_to: [InfoSection]
    trigger: info_sections_list
    logic: Parents, teachers and admins of the community get the sections that are not hidden, in order, each with its title, text, key and whether the caller may edit it (BR87). A caller outside the community is refused. The page always shows every visible section, the season only limits duty-card links (BR88.2).
    violation: Denied refusal for a caller outside the community.
    source: FR10.1, AC10.1.1, NFR3
  - id: BR86.2
    statement: The page starts with six sections holding the spreadsheet's instructions.
    category: policy
    applies_to: [InfoSection]
    trigger: the unit's migration
    logic: The community starts with, in this order, "Reggeli teendők" (morning), "Délutáni, esti teendők" (afternoon), "Locsolás" (watering, March to October), "Szombati takarítás" (saturday-cleaning), "Állatok etetése és ápolása" (animal-feeding) and "Nagytakarítás" (big-cleaning), filled from appendices A and B and the background of appendix D, with the fire warning and curtain-washing note of appendix C in "Nagytakarítás". The first five are owned by the group named Állatgondozás and the last by the group named Nagytakarítás szervezése (Q6); the owner is stored as the group's name, so the migration works whether or not those groups exist yet (BR87.6). The text is checked to hold no person's name or contact details before it is added.
    violation: Not applicable; starting data.
    source: FR10.5, AC10.1.1, Q6, NFR1
  - id: BR86.3
    statement: Hidden sections are seen only by super admins.
    category: authorization
    applies_to: [InfoSection]
    trigger: info_sections_list
    logic: A super admin also gets the hidden sections, marked as hidden, so they can restore one. Nobody else gets them, and a duty card never links to one.
    violation: Not applicable; a read.
    source: Q7
  - id: BR87.1
    statement: A coordinator of the owning group edits the text of that group's sections.
    category: authorization
    applies_to: [InfoSection]
    trigger: info_section_update
    logic: IF the caller is an active coordinator (an unrevoked group-admin grant, ADR-010) of the section's owning group as resolved by BR87.6, THEN they may change its text, unless the section is hidden (then it answers as missing); title, owner, season, order and hiding stay as they are. The change is shown to everyone at their next page load.
    violation: Denied refusal when the caller is not allowed (BR87.3).
    source: FR10.2, AC10.2.1, Q7
  - id: BR87.2
    statement: A super admin edits every section and adds, hides and restores sections.
    category: authorization
    applies_to: [InfoSection]
    trigger: info_section_update, info_section_create, info_section_set_hidden
    logic: A super admin may change any section's title, text, owning group, season months and order, add a section (its key is made from the title and must be unique), and hide or restore one. The owning group is picked from the working groups of the school year current today and stored by its name (BR87.6), or cleared. Sections are never deleted.
    violation: Validation refusal INFO_KEY_TAKEN when the new key exists; INFO_GROUP_INVALID when no working group of that name exists in the community's current school year.
    source: FR10.2, AC10.2.2, Q7
  - id: BR87.3
    statement: Nobody else edits a section.
    category: authorization
    applies_to: [InfoSection]
    trigger: info_section_update, info_section_create, info_section_set_hidden
    logic: A coordinator of another group, a coordinator whose grant was revoked, a parent and a teacher are refused. A coordinator cannot change a section's owner, season, order or hiding, nor add one.
    violation: Denied refusal (authorization_denied).
    source: AC10.2.2, NFR3
  - id: BR87.4
    statement: An edit made on an outdated screen is refused, and a repeated save changes nothing more.
    category: constraint
    applies_to: [InfoSection]
    trigger: info_section_update, info_section_set_hidden
    logic: The caller passes the version they saw; IF it differs, THEN the edit is refused and the editor reloads; a second editor at the same moment gets the same refusal. The idempotency key returns the first result for a repeated click.
    violation: Conflict refusal VERSION_CONFLICT.
    source: NFR5
  - id: BR87.5
    statement: Section text uses simple formatting that cannot run code.
    category: validation
    applies_to: [InfoSection]
    trigger: info_section_update, info_section_create
    logic: The title is 1 to 120 characters and the text at most 20 000. The text may use paragraphs, bulleted and numbered lists, bold and links (Q8). Links must start with https:// or http://, or be a path inside the app, which starts with a single "/" followed by a character other than "/" or "\" (so "//host" and "/\host" are refused). Anything else, such as HTML tags, is shown as plain text, never run. The stored text is the author's text; it is made safe when shown.
    violation: Validation refusal INFO_TEXT_INVALID for an empty or too long title or text, or a link of another kind.
    source: Q8, FR10.2
  - id: BR87.6
    statement: A section's owner carries over to each new school year by the group's name.
    category: policy
    applies_to: [InfoSection]
    trigger: info_sections_list, info_section_update
    logic: Working groups exist per school year and a name is unique within a year. The owning group of a section is the active working group whose name matches owningGroupName, ignoring letter case, in the school year current on the day of the check (C3 school_year_for). So when a new school year brings a new Állatgondozás group, its coordinators edit the animal-care sections with no change by anyone. IF no school year is current, or the current year has no group of that name, or owningGroupName is empty, THEN no coordinator edits the section and only super admins do; the section stays readable.
    violation: Denied refusal for a coordinator, as in BR87.3, while no owning group resolves.
    source: FR10.2, AC10.2.1, Q6
  # --- Duty-card links ----------------------------------------------------------------------------
  - id: BR88.1
    statement: A duty card links to the sections that belong to the duty.
    category: policy
    applies_to: [InfoSection, Duty]
    trigger: the duty card read
    logic: A morning slot links to "Reggeli teendők" and an afternoon slot to "Délutáni, esti teendők". The weekend animal-care duty and its weekend slots (U6) link to "Szombati takarítás" and "Állatok etetése és ápolása". Each link opens the information page at the section's anchor. Other duties get no link from this unit.
    violation: Not applicable.
    source: FR10.3, AC10.1.2, Q6
  - id: BR88.2
    statement: A seasonal section is linked only in its months.
    category: policy
    applies_to: [InfoSection]
    trigger: the duty card read
    logic: Morning and afternoon slots also link to "Locsolás" when the slot's month is in the section's season (March to October). Outside its months a seasonal section is not shown on any duty card; the information page still shows it.
    violation: Not applicable.
    source: FR10.4, AC10.1.3, Q6
  - id: BR88.3
    statement: A hidden section is never linked.
    category: policy
    applies_to: [InfoSection]
    trigger: the duty card read
    logic: IF a linked section is hidden, THEN the duty card leaves the link out.
    violation: Not applicable.
    source: Q7
  # --- Locking --------------------------------------------------------------------------------------
  - id: BR89.1
    statement: Commands that touch several slots lock in a fixed order.
    category: constraint
    applies_to: [SlotCalendar, Duty, Place]
    trigger: animal_slots_create, animal_calendar_save
    logic: The calendar row is locked first, then the slot duties in ascending id, then places in ascending id, following the community's lock order (family, then task rows, then assignment rows; a command here touches no family row). Sign-up and give-up lock as U2 and U7 do. So two people acting at once get the same result as acting one after the other.
    violation: Not applicable.
    source: NFR5, team.md Code Style
```

## Rules summary

| Group | Rules | What they settle |
|---|---|---|
| The year's slots | BR80.1 to BR80.5 | Who creates slots, two per weekday with breaks, re-creation adds only missing days, start times (holders told of a change), alert group |
| Signing up | BR81.1 to BR81.6 | Who may sign up, taken and started slots, no limit per family, who sees the slots |
| Giving up | BR82.1 to BR82.5 | Holder only, slots only, until 24 hours before, not in a swap, frees the slot |
| Fair share | BR83.1 to BR83.5 | What counts, which families, average and own share, display, never blocks |
| Fair-share reminder | BR84.1 to BR84.4 | First weekday of the month, below share only, once a month |
| Empty-slot warnings | BR85.1 to BR85.6 | Next three calendar days, one message per family a day, day-before alert, safe to run twice |
| Information page | BR86.1 to BR87.6 | Who reads, starting sections, hidden sections, who edits what, outdated screens, safe formatting, owner carried over to each school year by group name |
| Duty-card links | BR88.1 to BR88.3 | Which duty links where, watering season, hidden sections |
| Locking | BR89.1 | Fixed lock order for bulk slot commands |
