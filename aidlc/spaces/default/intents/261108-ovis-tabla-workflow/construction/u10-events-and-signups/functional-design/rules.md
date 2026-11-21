# Business Rules: u10-events-and-signups

Built from `unit-of-work.md` (U10), `unit-of-work-story-map.md`, `stories.md` (US11.1 to US11.4, US17.1), `requirements.md` (FR1, FR2.3, FR4.4, FR11, FR17.4, NFR3 to NFR5, NFR10), `components.md`, `contract-summary.md` (C1, C2, C6 to C8, C10, C13, C14, C16, C18), `decisions.md` and `functional-design-questions.md` (Q1 to Q6). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about scope and reach still hold unless a rule here says it replaces one. Contains no names or contact details.

All times are Budapest time. An event is *open* while it is planned and its end has not passed; it is *finished* once its end has passed; it is *cancelled* when its status says so.

## Rules

```yaml
rules:
  # --- Creating and changing an event ------------------------------------------------------
  - id: BR100.1
    statement: A super admin creates and changes community events, and a coordinator creates and changes the events of their own working group, and nothing of another group.
    category: authorization
    applies_to: [Event]
    trigger: event_save, event_notices_save, event_role_save, event_role_remove
    logic: IF the event has no working group THEN the caller must be a super admin. IF it has one THEN the caller must be a super admin or a coordinator of that group (can_manage_group, C2). A parent, a teacher, a coordinator of another group and a caller with no active session are refused. A group of another community answers as if it did not exist.
    violation: Denied refusal (authorization_denied); nothing changes.
    source: FR11.1, FR2.3, AC11.1.1, AC11.1.2, contract C2
  - id: BR100.2
    statement: A changed event must still match what the caller saw, and a group that is archived or unknown is refused.
    category: validation
    applies_to: [Event]
    trigger: event_save
    logic: IF the event exists THEN the caller sends its version and a different version is refused. IF the group is archived THEN refuse on the group field (archived). IF the group changes while the event has tasks THEN refuse on the group field (locked). The event is locked before any of its tasks (BR122.1).
    violation: Conflict refusal (VERSION_CONFLICT) or validation refusal on the field; nothing changes.
    source: FR11.1, contract C1, today's event_save
  - id: BR101.1
    statement: An event has a start and an end, and may last several weeks.
    category: validation
    applies_to: [Event]
    trigger: event_save
    logic: Both startsAt and endsAt are required and endsAt may not be before startsAt. Any length is allowed, so an event of several weeks is one event. An event may be made for a date in the past, so that last year's occasion can be recorded.
    violation: Validation refusal on starts_at, ends_at or ends_at (before_start).
    source: FR11.2, AC11.1.1
  - id: BR102.1
    statement: An event carries a title, a place and four settings that other units read.
    category: validation
    applies_to: [Event]
    trigger: event_save
    logic: The title is required, 1 to 200 characters after trimming. The place is optional, up to 200. isSummer and foodSignupOn are true or false and default to false. signupDeadline is optional and, when set, not after the date of endsAt. noticeLeadDays is optional, a whole number of days from 1 to 60. Turning foodSignupOn off keeps the offers already made and refuses new ones (BR113.1).
    violation: Validation refusal on the field.
    source: FR11.1, FR12.6, FR13.2, FR13.3, FR11.7, Q5
  - id: BR103.1
    statement: An event shows its notices at the top, in the order given.
    category: constraint
    applies_to: [EventNotice]
    trigger: event_notices_save
    logic: A notice is 1 to 300 characters after trimming. An event has at most 10. Positions run 1 to the count. An allergen notice is an ordinary notice written by the organiser. The three fixed notes of today's event (allergen, supply, food) no longer exist; event_save_notes is replaced by event_notices_save.
    violation: Validation refusal on notices (too_many or text_invalid).
    source: FR11.4, AC11.1.3, Q5
  - id: BR103.2
    statement: The list of notices is saved as a whole.
    category: constraint
    applies_to: [EventNotice, Event]
    trigger: event_notices_save
    logic: The caller sends the whole list and the event's version. The access check of BR100.1 runs first, then the version, then the list. The old list is replaced in one transaction and the event's version goes up by one. A list equal to the stored one still succeeds and changes nothing else. The caller sends an idempotency key.
    violation: Denied, conflict (VERSION_CONFLICT) or validation refusal; the old list stays.
    source: AC11.1.3, contract C1
  # --- Who sees events -----------------------------------------------------------------------
  - id: BR104.1
    statement: Every signed-in person of the community reads every event, with its notices, roles, tale, sign-ups and food offers.
    category: authorization
    applies_to: [Event, EventNotice, EventRole, EventSignup, FoodOffer]
    trigger: event_list, event_get, event_list_for_group
    logic: can_read_community (C2) lets a parent, a group admin, a super admin and a teacher read. A group event shows its group name. Reads return the C6 display of the people named, so a removed person shows as korábbi tag. A caller outside the community, or without an active session, gets the denied refusal and never an empty list. Tables are not readable directly (the team's rule); everything goes through the functions.
    violation: Denied refusal.
    source: FR1.2, FR1.3, FR1.6, AC11.1.1, contract C1, contract C6
  - id: BR104.2
    statement: The events list shows upcoming events, and a switch shows the finished ones.
    category: policy
    applies_to: [Event]
    trigger: event_list
    logic: The default list holds the open events, soonest start first. With the past switch it holds the finished and cancelled events whose end has passed, newest end first, for every reader. A cancelled event that has not yet ended stays in the default list, marked cancelled. A finished event keeps its tale, roles, notices, sign-ups and offers readable.
    violation: Not applicable; a read.
    source: AC11.3.2, FR11.6, Q2
  - id: BR104.3
    statement: A teacher reads events and changes nothing.
    category: authorization
    applies_to: [Event, EventSignup, FoodOffer]
    trigger: every event command
    logic: A teacher has no family and no group grant, so every command that creates or changes an event, a role, a notice, a sign-up or an offer refuses with the denied code. The screens offer them no such control.
    violation: Denied refusal.
    source: FR1.6, contract C2
  # --- Roles and organisers ----------------------------------------------------------------
  - id: BR105.1
    statement: A role has a name and exactly one person, either a parent with an account or a typed name; only after a removal (BR124) may it hold neither.
    category: validation
    applies_to: [EventRole]
    trigger: event_role_save
    logic: The role name is 1 to 100 characters. The person is a parent chosen from the active parents with an account who may be shown to the caller, or a typed name of 1 to 200 characters; never both, and never neither when saving; a role cleared by a removal holds neither and shows korábbi tag. An event has at most 20 roles. The caller sends the role's version when changing one.
    violation: Validation refusal (person_invalid, too_many) or conflict (VERSION_CONFLICT).
    source: FR11.5, AC11.3.1, AC11.3.3
  - id: BR105.2
    statement: A typed name has no link and no profile.
    category: policy
    applies_to: [EventRole]
    trigger: reading an event
    logic: A role held by a typed name is shown as typed, with no link, no contact detail and no profile. A role held by a parent is shown through C6, with the same visibility the directory gives (a parent who shares nothing is shown by name only).
    violation: Not applicable; a read.
    source: FR11.10, AC11.3.3, FR9
  - id: BR105.3
    statement: Only a manager of the event changes or removes its roles.
    category: authorization
    applies_to: [EventRole]
    trigger: event_role_save, event_role_remove
    logic: The access check of BR100.1 applies to the role's event. Removing a role deletes it and writes nothing to the people named.
    violation: Denied refusal.
    source: FR11.5, AC11.3.1
  - id: BR106.1
    statement: The organisers of an event are the coordinators of its group, or the super admins for a community event, and the parents whose role is marked organiser.
    category: calculation
    applies_to: [EventRole, Event]
    trigger: event_organisers(event_id), contract C13
    logic: Returns parent ids. For a community event, every active super admin who has a parent record. For a group event, the active coordinators of that group. Plus every parent holding a role of the event with isOrganiser set who is still active. The result has no duplicates and is empty for an unknown event. The caller needs no right; it is internal and read only.
    violation: Not applicable; internal.
    source: FR13.1, Q4, contract C13
  - id: BR106.2
    statement: Marking a role as organiser gives its parent no right to edit the event.
    category: constraint
    applies_to: [EventRole]
    trigger: event_role_save
    logic: isOrganiser is accepted only on a role held by a parent. It makes that parent an organiser for BR106.1 only. The parent's rights in BR100.1 do not change. Marking or unmarking is audited (BR123.1).
    violation: Validation refusal ROLE_ORGANISER_NEEDS_ACCOUNT on a typed name.
    source: Q4, FR13.1
  - id: BR107.1
    statement: The year's tale is free text kept with its event.
    category: constraint
    applies_to: [Event]
    trigger: event_tale_save
    logic: A manager of the event (BR100.1) saves the tale, up to 5000 characters, empty to clear it, with the event's version. The tale is shown on the event page to every reader (BR104.1), including after the event is finished.
    violation: Denied, conflict (VERSION_CONFLICT) or validation refusal on tale.
    source: FR11.6, AC11.3.2
  # --- Sign-ups with a note ------------------------------------------------------------------
  - id: BR108.1
    statement: A parent with a family signs up for an open event with a note.
    category: authorization
    applies_to: [EventSignup]
    trigger: event_signup_add
    logic: The caller needs an active session and a current family (C2); a teacher or a caller with no family is refused as for every family-based command. The event must be open (BR104 defines open). The note is optional, up to 500 characters. The sign-up stores the caller as parent and the caller's family. The caller sends an idempotency key, and a repeated key returns the stored result.
    violation: Denied refusal, or EVENT_CLOSED when the event is cancelled or finished; nothing is saved.
    source: FR11.3, AC11.2.1, contract C2
  - id: BR108.2
    statement: A sign-up may carry a chosen date and time inside the event.
    category: validation
    applies_to: [EventSignup]
    trigger: event_signup_add, event_signup_change
    logic: chosenAt is optional and, when set, lies between startsAt and endsAt of the event. It is shown beside the person's name.
    violation: Validation refusal on chosen_at (outside_event).
    source: FR11.11, AC11.2.2
  - id: BR108.3
    statement: Everyone who can read the event sees the sign-ups with name and note.
    category: policy
    applies_to: [EventSignup]
    trigger: event_get
    logic: Each sign-up shows the parent's and the family's display through C6, the note and the chosen time, oldest first. No other contact detail is returned.
    violation: Not applicable; a read.
    source: AC11.2.1, FR11.3, NFR10
  - id: BR108.4
    statement: The sign-up deadline is shown and enforced by nothing in this unit.
    category: policy
    applies_to: [Event, EventSignup, FoodOffer]
    trigger: event_signup_add, food_offer_add
    logic: The deadline date is returned with the event and shown to parents. A sign-up or an offer after it is still accepted while the event is open. Reminders and the alert about unclaimed tasks around the deadline belong to the checklists work.
    violation: Not applicable.
    source: FR13.3, interpretation recorded in the diary
  - id: BR109.1
    statement: A sign-up counts as its parent's family's and shows the parent.
    category: policy
    applies_to: [EventSignup]
    trigger: event_get
    logic: The parent is recorded and shown, and the family is shown with it, so the organiser sees which family helps.
    violation: Not applicable.
    source: FR11.3, AC11.2.1, requirements Q7
  - id: BR109.2
    statement: A parent may add several sign-ups to one event, up to 10.
    category: constraint
    applies_to: [EventSignup]
    trigger: event_signup_add
    logic: Counted per parent and event under the event's lock, so two requests at once cannot pass the limit together. The eleventh is refused.
    violation: Validation refusal EVENT_LIMIT_REACHED.
    source: Q1, AC11.2.1
  - id: BR110.1
    statement: A parent changes or withdraws their own sign-up until the event ends.
    category: authorization
    applies_to: [EventSignup]
    trigger: event_signup_change, event_signup_withdraw
    logic: Only the parent who made it. A change needs an open event; a withdrawal is allowed on a cancelled or finished event too. The caller sends the sign-up's version. A sign-up already withdrawn answers as denied to a repeated call with a new key, because the row is gone and the owner check cannot match.
    violation: Denied, EVENT_CLOSED, conflict (VERSION_CONFLICT) or validation refusal.
    source: Q1, AC11.2.1
  - id: BR110.2
    statement: A manager of the event may remove any sign-up or offer but not edit it.
    category: authorization
    applies_to: [EventSignup, FoodOffer]
    trigger: event_signup_withdraw, food_offer_withdraw
    logic: The access check of BR100.1 applies. Removal deletes the row and is audited with the event id, never the note or the dish text.
    violation: Denied refusal.
    source: FR2.3, NFR4
  - id: BR111.1
    statement: Taking part in an event is voluntary and counts towards nothing.
    category: constraint
    applies_to: [EventSignup, FoodOffer]
    trigger: fair-share counts, rota planning, standing, reminders
    logic: A sign-up and an offer are neither a duty nor a place. No function of rota planning, family standing, fair share or the daily reminders reads them, so a sign-up never raises or lowers a family's count and never triggers a duty reminder. The fair-share function (U8) counts animal-care places only.
    violation: Not applicable; checked by a test that an event sign-up leaves every count unchanged.
    source: FR11.12, AC11.2.3
  - id: BR112.1
    statement: The leaving and new family rule applies to event tasks and not to the voluntary sign-up.
    category: policy
    applies_to: [EventSignup, DutyTask]
    trigger: duty_sign_up on an event task, event_signup_add
    logic: Signing up for a place on an event task calls family_may_hold_duty (C10) with the task's start date, as for every duty, and a family that may not hold it is refused with DUTY_INELIGIBLE. The sign-up with a note holds no duty, so it is accepted from every family with an account.
    violation: DUTY_INELIGIBLE for an event task only.
    source: FR4.4, unit-of-work.md U10 notes, contract C10, interpretation recorded in the diary
  # --- Food offers ------------------------------------------------------------------------------
  - id: BR113.1
    statement: A parent offers food on an open event whose food sign-up is on.
    category: authorization
    applies_to: [FoodOffer]
    trigger: food_offer_add
    logic: Same caller rules as BR108.1. The event must be open and its foodSignupOn true. The category is one of the eight values, the text 1 to 200 characters, and the three ticks default to false. The caller sends an idempotency key.
    violation: Denied refusal, EVENT_CLOSED, or FOOD_SIGNUP_OFF; validation refusal on category or text.
    source: FR11.7, AC11.4.1
  - id: BR113.2
    statement: There are eight fixed categories.
    category: constraint
    applies_to: [FoodOffer]
    trigger: food_offer_add, food_offer_change
    logic: spreads, bread, free_from, savoury, sweet, drinks, vegetables_fruit, other. Hungarian labels are fixed in the screen. A ninth value cannot be stored.
    violation: Validation refusal on category.
    source: FR11.7, AC11.4.1
  - id: BR113.3
    statement: A parent may make several offers on one event, up to 20.
    category: constraint
    applies_to: [FoodOffer]
    trigger: food_offer_add
    logic: Counted per parent and event under the event's lock. The twenty-first is refused.
    violation: Validation refusal EVENT_LIMIT_REACHED.
    source: FR11.7, AC11.4.1
  - id: BR114.1
    statement: Everyone who can read the event sees its offers, grouped by category, with the ticks.
    category: policy
    applies_to: [FoodOffer]
    trigger: event_get
    logic: Each offer shows its category, text, the three ticks and the parent through C6. Offers of a category are listed together so that a missing category is easy to see.
    violation: Not applicable.
    source: FR11.8, AC11.4.2
  - id: BR115.1
    statement: Allergen ticks describe a dish's ingredients and nothing else.
    category: constraint
    applies_to: [FoodOffer]
    trigger: storing and showing an offer, a notice, an audit entry
    logic: The only allergen data is the three ticks on the dish. No field, function, notice or audit entry links an allergen to a child, a family's health or a diet, and the screen words them as what the dish contains ("Tartalmaz tejet" and so on). Notices and audit entries never carry the ticks or the dish text.
    violation: Not applicable; a test reads every column and function result for such a link.
    source: FR11.9, AC11.4.3
  - id: BR116.1
    statement: A parent changes or withdraws their own offer until the event ends.
    category: authorization
    applies_to: [FoodOffer]
    trigger: food_offer_change, food_offer_withdraw
    logic: Only the parent who made it. A change needs an open event; a withdrawal is allowed on a cancelled or finished event too. The caller sends the offer's version. Turning the food sign-up off does not stop a parent changing or withdrawing an offer.
    violation: Denied, EVENT_CLOSED, conflict (VERSION_CONFLICT) or validation refusal.
    source: AC11.4.1
  # --- Notices -----------------------------------------------------------------------------------
  - id: BR117.1
    statement: A new open event tells the people it concerns.
    category: policy
    applies_to: [Event, NoticeKind]
    trigger: event_save creating an event
    logic: In the same transaction, notice_send (C8) is called with kind event_new and target type event. A community event goes to every active parent with an account. A group event goes to the active members of that group who have an account. The creator is left out. The once key is event_new plus the event id. An event whose end has already passed sends nothing. A failed email never fails the save.
    violation: Not applicable; a failed send is recorded by U5.
    source: Q3, AC17.1.1, AC17.1.6, contract C8
  - id: BR117.2
    statement: A cancelled event, and a change of dates or place, tell the people involved.
    category: policy
    applies_to: [Event, NoticeKind]
    trigger: event_save changing status to cancelled, startsAt, endsAt or location
    logic: Recipients are the parents who hold a sign-up or a food offer on the event, and the parents of every family holding a place on one of its tasks, without the caller and without duplicates. A cancellation sends event_cancelled with the once key plus the event id. A change of startsAt, endsAt or location of a planned event sends event_changed with a once key made of the event id and the new version, so a second different change tells again. A change of title, notices, roles, tale or settings tells nobody. A finished event sends nothing.
    violation: Not applicable.
    source: Q3, AC17.1.1, AC17.1.6, contract C8
  - id: BR117.3
    statement: An event notice links to its event and carries no other family's details.
    category: constraint
    applies_to: [NoticeTarget]
    trigger: notice_send, the event facts function
    logic: The notice's target is the event and it opens /szulo/esemenyek/[id]. Its text is the Hungarian title prefix with the event title, and for a change the new dates and place. It never lists who signed up or what is offered. Delivery, retries, no double sending and the failure list are U5's (AC17.1.2 to AC17.1.5).
    violation: Not applicable.
    source: AC17.1.4, AC17.1.6, NFR10, contract C8
  # --- Cancelling and related lists ---------------------------------------------------------
  - id: BR118.1
    statement: A cancelled event keeps its sign-ups and offers but accepts no new ones.
    category: constraint
    applies_to: [Event, EventSignup, FoodOffer, DutyTask]
    trigger: event_save setting the status to cancelled
    logic: The event's open tasks are closed, locked in ascending id order after the event (today's behaviour, kept). Sign-ups and offers stay readable. New sign-ups and offers, and changes to them, are refused with EVENT_CLOSED, but the parent may still withdraw their own. Setting the status back to planned makes the event open again if it has not ended, and does not reopen closed tasks.
    violation: EVENT_CLOSED.
    source: FR11.1, today's event_save, Q3
  - id: BR119.1
    statement: The coordinator page reads a group's events through one list.
    category: authorization
    applies_to: [Event]
    trigger: event_list(group_id), contract C14
    logic: Returns rows of id, title and status for the events of that working group, upcoming first then finished. The caller must satisfy can_manage_group; otherwise the denied refusal, never an empty list. A separate read, event_list_for_group, returns the same rows with dates, the sign-up count and the caller's own sign-up flag to every signed-in reader of the community for the group page, as the event pages themselves are readable.
    violation: Denied refusal.
    source: contract C14, FR2.3, US2.4
  - id: BR120.1
    statement: Event facts are readable by the checklists work through three internal functions.
    category: calculation
    applies_to: [Event]
    trigger: event_is_summer, event_deadline, event_organisers, contract C13
    logic: event_is_summer returns true or false, or null for an unknown event. event_deadline returns the date or null. event_organisers is BR106.1. All are internal, read only and never granted to a signed-in user.
    violation: Not applicable.
    source: contract C13, FR12.6, FR13.3
  - id: BR121.1
    statement: Today's event tasks are kept as they are.
    category: policy
    applies_to: [DutyTask, Event]
    trigger: task_save, duty_sign_up, swap functions on an event task
    logic: A task of an event keeps its places, notes, swaps and cancellations. It gains only what U1 and U6 gave every duty, the event's scope and the C10 check (BR112.1). No function of this unit creates or edits a task. The checklists work decides later what happens to them.
    violation: Not applicable.
    source: Q6, unit-of-work.md U10 notes
  # --- Locks, repeats, audit and removal ---------------------------------------------------
  - id: BR122.1
    statement: Every event command locks in a fixed order and is safe to repeat and to run twice at once.
    category: constraint
    applies_to: [Event, EventNotice, EventRole, EventSignup, FoodOffer, DutyTask]
    trigger: every command of this unit
    logic: A command takes the event row first, then the rows it changes by ascending id, and the event's tasks, when it needs them, after the event and in ascending id order (C1 duty step). Two commands on one event therefore run one after the other. Every command takes an idempotency key and a repeated key returns the stored result; a changing command also takes the version of the row it changes. A key reused with other content is a conflict.
    violation: Conflict refusals idempotency_key_reused and VERSION_CONFLICT.
    source: NFR3, contract C1
  - id: BR123.1
    statement: Sensitive changes to events are audited without names or text.
    category: policy
    applies_to: [Event, EventRole, EventSignup, FoodOffer]
    trigger: event cancellation, marking or unmarking an organiser role, removal of a sign-up or offer by a manager, clearing a typed name, removal apply
    logic: One audit entry records the action, the actor and the target ids. It never holds a name, a note, a dish text or an allergen tick. The change rolls back when the entry cannot be written.
    violation: The change rolls back.
    source: NFR4, NFR5, contract C1
  - id: BR124.1
    statement: Removing a parent or a family anonymises their sign-ups and offers and clears their roles.
    category: constraint
    applies_to: [EventSignup, FoodOffer, EventRole]
    trigger: events_removal_preview and events_removal_apply (contract C16)
    logic: For a parent, or for every parent of a family, the block clears parentId and familyId on their sign-ups and offers, keeping the rows so that the event's history stays whole, and clears parentId and isOrganiser on their roles. It also clears personName on roles of events whose typed name equals the removed person's display name exactly. Preview returns how many rows would be cleared (to_clear) and zero to flag (to_flag). Apply returns the same counts and runs in the same transaction as the removal. A cleared row shows as korábbi tag through C6. A block returns zero counts for a subject kind it does not hold. The notes of anonymised sign-ups stay; whether to clear them too is an open point for U14.
    violation: Not applicable; internal.
    source: contract C16, AC3.6.5, FR11.12
  - id: BR124.2
    statement: A super admin can clear any typed name on a role that refers to a removed person.
    category: authorization
    applies_to: [EventRole]
    trigger: event_role_clear_name(role_id, p_expected_version, p_idempotency_key)
    logic: Only a super admin. The role must hold a typed name. The name is cleared and the role then shows korábbi tag. The removal screen lists the typed names of roles that do not match exactly, so the super admin can decide. Audited (BR123.1).
    violation: Denied, conflict (VERSION_CONFLICT) or validation refusal (no_typed_name).
    source: contract C16
```

## Summary

| Question | Answer | Rule |
|---|---|---|
| Who creates and edits events? | A super admin for a community event, a coordinator for their group's | BR100.1 |
| Who can read events? | Every signed-in person, teachers included, who change nothing | BR104.1, BR104.3 |
| How are finished events found? | A past-events switch on the list, for everyone | BR104.2 |
| How many notices does an event show? | Up to 10 lines of up to 300 characters, at the top | BR103.1 |
| Who is an organiser? | Coordinators or super admins, plus parents whose role is marked organiser; no edit right | BR106.1, BR106.2 |
| How is a person on a role stored? | A parent with an account, or a typed name with no link | BR105.1, BR105.2 |
| How many sign-ups can a parent make? | Up to 10 per event, each with a note and optional time | BR109.2, BR108.2 |
| Does a sign-up count for anything? | No, never | BR111.1 |
| Do leaving and new families hold event tasks? | The task rule applies; the voluntary sign-up has none | BR112.1 |
| What does a food offer hold? | Category, text, three ingredient ticks, never linked to health | BR113, BR115.1 |
| Who is told about an event? | New event: everyone it concerns. Cancelled or changed: people with a sign-up, an offer or a task | BR117.1, BR117.2 |
| What happens on cancelling? | Open tasks close, sign-ups and offers stay, nothing new is accepted | BR118.1 |
| What happens on removing a person? | Sign-ups and offers are anonymised, roles cleared | BR124.1 |
