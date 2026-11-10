# User Stories

Grouped by feature area, built from `requirements.md` and the answers in `user-stories-questions.md` (Q1 to Q8). Group numbers match the requirement groups. Personas are in `personas.md`. Today's behaviour is described in `business-overview.md` and `component-inventory.md`. Testing follows `team-practices.md`: every database rule also gets the fixed test list. Contains no names or contact details.

Priorities use MoSCoW. All stories are in version 1; the build order is set in Delivery Planning.

## Group 1. Community and working-group structure

### US1.1 One community instead of kindergarten groups (Must Have)

As an administrator, I want the app to work for one community with working groups, so that it matches how we are organised.

- **AC1.1.1** Given the new structure is installed, When a rota, community event, directory entry or book is created, Then it belongs to the community and not to a group.
- **AC1.1.2** Given a working-group event or to-do task, When it is created, Then it belongs to exactly one working group.
- **AC1.1.3** Given today's records are test data only (Q6), When the structure changes, Then the app starts clean with fresh invented data and no kindergarten-group scope remains.

Dependencies: none. INVEST: small if limited to structure; everything else builds on it.

### US1.2 The six working groups exist (Must Have)

As a parent, I want to see the working groups of this school year, so that I know what they do.

- **AC1.2.1** Given a fresh install for 2026-2027, When a user opens the working groups, Then the six groups are listed with name, description and school year.
- **AC1.2.2** Given a signed-out visitor, When they open the list, Then they are sent to sign-in and see no group data.

### US1.3 Roles match the new structure (Must Have)

As an administrator, I want the former group-admin role to apply to one working group, and teachers to read across the community, so that rights fit the new structure.

- **AC1.3.1** Given a working-group admin, When they act on their own group's event, Then it is allowed.
- **AC1.3.2** Given the same admin, When they act on another group's event, Then it is refused, including when the request bypasses the screen.
- **AC1.3.3** Given a teacher, When they open any working group, event or task, Then they can read it and cannot change it.

Dependencies: US1.1.

## Group 2. Working groups

### US2.1 Join and leave a working group (Must Have)

As a parent, I want to join and leave working groups myself, so that I can help where I can.

- **AC2.1.1** Given I am in no group, When I join a group, Then I appear as a member at once.
- **AC2.1.2** Given I am in one group, When I join another, Then I am in both.
- **AC2.1.3** Given I click join twice, When the second request arrives, Then I am a member once.
- **AC2.1.4** Given I am a member, When I leave, Then I am no longer listed, and my past claims stay in the history.
- **AC2.1.5** Given I coordinate a group, When I leave it, Then my admin right for that group ends at once, and the action is in the audit log.
- **AC2.1.6** Given a group with no coordinator, When anyone opens it, Then it says the group has no coordinator, and only a super admin can manage it.

### US2.2 See who is in a group (Should Have)

As a teacher or parent, I want to see a group's members, so that I know whom to contact.

- **AC2.2.1** Given a member who has not shared their profile, When another parent views the group, Then only the member's full name is shown.
- **AC2.2.2** Given the same member, When a teacher views the group, Then the name, phone and email are shown.

### US2.3 Appoint coordinators (Must Have)

As an administrator, I want to give a group member working-group admin rights, so that the elected coordinator can run the group.

- **AC2.3.1** Given a member of a group, When I grant the right, Then they can manage that group, and the grant is in the audit log.
- **AC2.3.2** Given a group with one coordinator, When I grant a second, Then both have the right (Q8).
- **AC2.3.3** Given a parent who is not a member of the group, When I try to grant it, Then it is refused with a reason.
- **AC2.3.4** Given a coordinator whose right I revoke, When they make their next request, Then it is refused.

Dependencies: US1.3, US2.1.

### US2.4 Manage my group's work (Must Have)

As a coordinator, I want to manage my group's events, to-do tasks, recurring duties and templates, so that the group can organise itself.

- **AC2.4.1** Given I coordinate a group, When I open its management page, Then I can manage those four things for that group.
- **AC2.4.2** Given a teacher tells me about a repair, When I add it as a to-do task, Then it appears on my group's list; the app has no separate reporting screen.

Dependencies: US2.3, and the stories in groups 9, 11, 12 and 14 for the items managed.

## Group 3. Parent directory and own profile

### US3.1 Browse the directory (Must Have)

As a parent, I want to see the other parents, so that I can get to know the community and reach people.

- **AC3.1.1** Given a parent who ticked sharing, When I open the directory, Then I see their name, phone, email, place of residence, occupation, hobby and how they support the community.
- **AC3.1.2** Given a parent who did not tick sharing, When I open the directory, Then I see only their full name.
- **AC3.1.3** Given a family where every parent ticked sharing, When I view it, Then I see the children's names; the parents appear together as one family.
- **AC3.1.4** Given a family where one parent ticked and another did not, When I view it, Then no child's name is shown (Q2).
- **AC3.1.5** Given a request that bypasses the screen, When it asks for an unticked parent's details, Then the database returns only the name.
- **AC3.1.6** Given a single-parent family, When that parent has ticked sharing, Then the children's names are shown.
- **AC3.1.7** Given a family with no children, When it is viewed, Then no children section is shown.
- **AC3.1.8** Given a parent without an account, who therefore cannot tick the box, When others view the family, Then only that parent's full name is shown and no child's name.

### US3.2 Control what others see (Must Have)

As a parent, I want to choose whether my full profile is shown, so that I stay in control of my data.

- **AC3.2.1** Given a new account, When it is first opened, Then the tick box is unticked.
- **AC3.2.2** Given I tick the box, When another parent next loads the directory, Then my profile is shown, and the change and its time are recorded in the audit log.
- **AC3.2.3** Given I untick the box, When another parent next loads the directory, Then only my name is shown.

### US3.3 Edit my own details (Must Have)

As a parent, I want to update my details, so that they stay correct.

- **AC3.3.1** Given I am signed in, When I change my phone, place of residence, occupation, hobby or how I support the community, Then the change is saved.
- **AC3.3.2** Given I enter an invalid phone number, When I save, Then the field is named and everything I typed is kept.
- **AC3.3.3** Given the page is out of date, When I save, Then I am told and nothing is overwritten.

### US3.4 Change my password and email (Must Have)

As a parent, I want to change my password and sign-in email, so that I can keep access to my account.

- **AC3.4.1** Given I am signed in, When I enter my current password and a valid new one, Then the password changes.
- **AC3.4.2** Given I give a new email, When I open the confirmation link sent to it, Then it becomes my sign-in email.
- **AC3.4.3** Given I have not confirmed, When I sign in, Then the old email still works.
- **AC3.4.4** Given the new email belongs to another account, When I submit it, Then it is refused without revealing whose it is.

### US3.5 Teachers can reach parents (Must Have)

As a teacher, I want to see every parent's phone and email, so that I can reach them.

- **AC3.5.1** Given a parent who did not tick sharing, When I open the directory as a teacher, Then I see the name, phone and email and no other profile field (Q9 of `requirements-analysis-questions.md`).

### US3.6 Add families and parents (Must Have)

As an administrator, I want to add and remove families and parents, so that the directory is correct.

- **AC3.6.1** Given a new family, When I add it with a parent's name and email, Then it appears in the directory.
- **AC3.6.2** Given a family with future duties, When I remove it, Then its duties are flagged for reassignment and I am told.
- **AC3.6.3** Given a parent or teacher, When they try to add a family, Then it is refused.
- **AC3.6.4** Given a family with more than one parent, When I remove one parent, Then their sign-in ends, their sharing choice is dropped, their contact details are no longer shown, and the removal is in the audit log.
- **AC3.6.5** Given a removed parent's past claims, picks, sign-ups and books, When anyone views the history, Then it stays readable with the person shown as "korábbi tag" (former member) and no personal details.
- **AC3.6.6** Given a family that has left, When an administrator deletes or anonymises it under the existing data-lifecycle process, Then all its new kinds of records (profiles, working-group memberships, claims, food offers, books) are deleted or anonymised the same way, and this is in the audit log.
- **AC3.6.7** Given a removed parent still holds a borrowed book or a claimed open task, When they are removed, Then the book or task is flagged for the administrator.

### US3.7 Invite a parent (Must Have)

As an administrator, I want to send an invitation from a screen, so that a parent can create their account.

- **AC3.7.1** Given a parent without an account, When I send an invitation, Then they get an email with a single-use link.
- **AC3.7.2** Given an already used link, or one older than 7 days, When it is opened, Then it explains the link is no longer valid, and an administrator can send a new one.

## Group 4. School calendar and joining or leaving

### US4.1 Set up the school year (Must Have)

As an administrator, I want to record school-break weeks and the changeover date, so that every rota follows them.

- **AC4.1.1** Given a school year, When I record a break week, Then every rota treats that week as a break.
- **AC4.1.2** Given a new school year, When I open it, Then the changeover date is 1 July, and I can change it (Q6 in the requirements).

### US4.2 Mark families as leaving or new (Must Have)

As an administrator, I want to mark families as leaving or new, so that they are not given duties at the wrong time.

- **AC4.2.1** Given a leaving family, When anyone tries to give it a duty after the changeover date by planning, assignment, sign-up or swap, Then it is refused with a reason.
- **AC4.2.2** Given a new family, When anyone tries to give it a duty before the changeover date, Then it is refused with a reason.
- **AC4.2.3** Given a family already holding a duty on the wrong side of the date, When I mark it, Then those duties are flagged, I am told, and the family keeps them until I reassign them (Q5).

Dependencies: US4.1.

## Group 5. Yearly rotas

### US5.1 Get a fair draft of the year (Must Have)

As an administrator, I want the app to propose the year's rotas, so that I don't plan them by hand.

- **AC5.1.1** Given the school year, the break weeks and the families, When I ask for a draft, Then indoor cleaning, front garden, water carrying and weekend animal care each have one family per duty week.
- **AC5.1.2** Given a draft, When it is checked, Then no two full-year families differ by more than one week in any rota (Q8), and part-year families have a share in proportion to their weeks.
- **AC5.1.3** Given a draft, When it is checked, Then no family has indoor cleaning and front garden in the same week.
- **AC5.1.4** Given a draft, When it is checked, Then indoor cleaning and water carrying have no duty in break weeks, and front garden and weekend animal care run every week (Q3).
- **AC5.1.5** Given too few families to fill a rota without breaking a rule, When I ask for a draft, Then the weeks that cannot be filled are shown as empty with the reason.

Dependencies: US4.1, US4.2. This story with US5.3 and US8.1 is the candidate for the thin first slice.

### US5.2 Adjust and publish (Must Have)

As an administrator, I want to change the draft and publish it, so that parents see the final plan.

- **AC5.2.1** Given an unpublished draft, When a parent opens the rotas, Then they do not see it.
- **AC5.2.2** Given a draft, When I change a week so that it breaks a rule, Then I am told which rule and the change is not saved.
- **AC5.2.3** Given a finished draft, When I publish it, Then parents see it, the families are notified, and the publishing is in the audit log.

### US5.4 Change a published duty (Must Have)

As an administrator, I want to change who holds a published duty, so that flagged, missed or vacated duties get covered.

- **AC5.4.1** Given a future published duty or an unpicked weekend slot, When a super admin assigns it to another family, Then the change is saved, both families are notified, and it is in the audit log.
- **AC5.4.2** Given the change would break the changeover rule or give a family indoor cleaning and front garden in the same week, When it is saved, Then it is refused with the reason.
- **AC5.4.3** Given the weekly duty of a family that has already made a weekend pick is moved, When the change applies, Then the pick moves to the new family if the slot is still valid; otherwise the new family is asked to pick.
- **AC5.4.4** Given a duty that has already passed, When anyone tries to change it, Then it is refused.
- **AC5.4.5** Given a working-group admin, parent or teacher, When they try to change a rota duty, Then it is refused.
- **AC5.4.6** Given a duty with a pending swap, When it is reassigned, Then the swap is cancelled and both families are told.

Dependencies: US5.2.

### US5.3 See my duty week (Must Have)

As a parent, I want my duty card to tell me what to do, so that I can do it during my week.

- **AC5.3.1** Given a duty is assigned to my family, When I open it, Then it shows the family name, the week and the instructions, and says there is no fixed day.
- **AC5.3.2** Given a front-garden week between March and October, When I open it, Then it includes watering the front garden; outside those months it does not.
- **AC5.3.3** Given a water-carrying week, When I open it, Then it says to fill all the bottles at the end of the week.

## Group 6. Linked weekend duties

### US6.1 Pick my weekend opening or closing (Must Have)

As a parent on indoor cleaning or front garden, I want to pick my opening or closing, so that the weekend is covered.

- **AC6.1.1** Given a normal week, When the week is published, Then the indoor-cleaning and front-garden families each must pick one of the four openings or closings, and the weekend family has the other two and the shelter cleaning.
- **AC6.1.2** Given a break week, When the week is published, Then only the front-garden family picks one, and the weekend family has the other three and the shelter cleaning (Q3).
- **AC6.1.3** Given a week where a picking family is missing, for example after a removal, When the week is shown, Then its duty falls to the weekend family and the administrator is told.
- **AC6.1.4** Given a slot already picked, When another family picks it at the same moment, Then one succeeds and the other is told to pick again.
- **AC6.1.5** Given the shelter cleaning, When a picking family tries to take it, Then it is refused.

Dependencies: US5.2.

### US6.2 Nobody forgets to pick (Must Have)

As an administrator, I want the app to chase families that haven't picked, so that I don't have to.

- **AC6.2.1** Given a family that hasn't picked, When it is the Wednesday before the weekend, Then the family is reminded once.
- **AC6.2.2** Given a family still hasn't picked at Friday noon, When the time passes, Then the administrator is notified, and can assign a slot.
- **AC6.2.3** Given a family has picked, When Wednesday comes, Then it gets no reminder.

## Group 7. Daily animal-care sign-up

### US7.1 Sign up for a slot (Must Have)

As a parent, I want to take a morning or afternoon slot, so that my family does its share.

- **AC7.1.1** Given a free slot on any weekday, including school breaks, When I sign up, Then my family holds it.
- **AC7.1.2** Given a taken slot, When I try to sign up, Then I am told it is taken.
- **AC7.1.3** Given my family would break the changeover rule, When I sign up, Then it is refused with the reason.

### US7.2 See the fair share (Must Have)

As a parent, I want to see how many slots each family has taken, so that everyone contributes evenly.

- **AC7.2.1** Given slots taken this school year, When I open the sign-up page, Then I see each family's count and the average over families active that year, with part-year families counted in proportion to their weeks (Q8).
- **AC7.2.2** Given a family below the average, When reminders run, Then it gets at most one reminder a month, and nothing is blocked (Q8).
- **AC7.2.3** Given a family at or above the average, When reminders run, Then it gets no reminder.

### US7.3 Nobody has to chase empty slots (Must Have)

As an administrator, I want the app to warn about empty slots, so that I don't chase families by hand.

- **AC7.3.1** Given empty slots in the next three days, When the daily check runs, Then each family gets at most one message that day listing them (Q7).
- **AC7.3.2** Given a slot still empty one day before, When the check runs, Then the administrator and the Animal Care coordinators are also notified.
- **AC7.3.3** Given a slot filled before the check, When the check runs, Then it is not listed.

## Group 8. Duty visibility and swaps

### US8.1 See who has which duty (Must Have)

As a parent, I want to see every family's duties, so that I know whom to ask for a swap.

- **AC8.1.1** Given published rotas, When I open the overview, Then I see the duties by week and by family name, whatever the families' sharing choice is.
- **AC8.1.2** Given no published rota, When I open the overview, Then it says nothing has been published yet.

Dependencies: US5.2.

### US8.2 Swap with another family (Must Have)

As a parent, I want to swap a duty with another family's, so that date conflicts can be solved.

- **AC8.2.1** Given my future duty and another family's future duty of any kind, When I propose a swap and they accept, Then the duties are exchanged at once without an administrator (Q2 in the requirements).
- **AC8.2.2** Given the swap would break the changeover rule or give a family indoor cleaning and front garden in the same week, When it is proposed or accepted, Then it is refused with a reason.
- **AC8.2.3** Given a swap of a week that carries a weekend pick, When it applies, Then the pick moves with the duty if the slot is still valid, otherwise the new family is asked to pick.
- **AC8.2.4** Given a swap has applied, When the administrator opens the swap list, Then they see it and can reverse it, and a reversal is in the audit log.
- **AC8.2.5** Given a swap proposal, When the other family declines, Then the duties stay as they were and the proposer is told.
- **AC8.2.6** Given a pending proposal, When the proposer withdraws it, Then it ends and the other family is told.
- **AC8.2.7** Given a pending proposal, When the earlier of the two duties starts before anyone answers, Then the proposal expires and both families are told.
- **AC8.2.8** Given a duty in a pending swap, When someone proposes another swap for it, Then it is refused; a duty is in at most one pending swap.
- **AC8.2.9** Given both families accept and act at the same moment as a change to either duty, When the requests arrive, Then the outcome is the same as one after the other, and an out-of-date acceptance is refused.
- **AC8.2.10** Given a swap whose duties have changed again since, When the administrator tries to reverse it, Then it is refused with the reason, and they can change the duties directly (US5.4).

### US8.3 Give a reason (Should Have)

As a parent, I want my reason to be seen, so that the other side understands the request.

- **AC8.3.1** Given a swap request with a reason, When the other family and the administrator open it, Then they see the reason.
- **AC8.3.2** Given a cancellation request with a reason, When the administrator decides it, Then they see the reason.

## Group 9. Recurring duties

### US9.1 Set up a recurring duty (Must Have)

As a coordinator, I want to create duties that repeat, so that regular care isn't forgotten.

- **AC9.1.1** Given a recurring duty with an interval, a start and an owner, When I save it, Then upcoming occurrences appear for the owner, and the next due date counts from the fixed schedule, not from the last done mark.
- **AC9.1.2** Given a seasonal duty limited to months such as March to October, When a date is outside them, Then no occurrence appears.
- **AC9.1.3** Given another group's coordinator, When they try to change it, Then it is refused.

### US9.2 Mark a duty done (Must Have)

As a parent, I want to mark a duty as done, so that everyone can see it's been handled.

- **AC9.2.1** Given a duty I am responsible for, When I mark it done, Then my name and the time are recorded.
- **AC9.2.2** Given a duty of another family or group, When I try to mark it done, Then it is refused.

### US9.3 Bottle cleaning (Should Have)

As the family on water duty, I want to be told when the bottles are due for cleaning, so that the drinking water stays clean.

- **AC9.3.1** Given every fourth water week by default, When the family opens its duty, Then it includes a "clean the bottles" duty to mark done.
- **AC9.3.2** Given an administrator changes the interval, When the next weeks are planned, Then the new interval applies.

### US9.4 The working groups' regular care (Should Have)

As a coordinator, I want my group's regular care on the list, so that it is owned by someone.

- **AC9.4.1** Given a fresh install, When the Animal Care coordinator opens the recurring duties, Then the periodic care from the animal-care sheet is there, with rabbit items switched off.
- **AC9.4.2** Given a fresh install, When the playground and maintenance coordinators open theirs, Then their inspection rounds are there and they can set the interval.
- **AC9.4.3** Given the seasonal jobs from the to-do list, When a fresh install is set up, Then mowing, weeding and turning the compost are recurring duties and not to-do tasks.

## Group 10. Information page

### US10.1 Read how things are done (Must Have)

As a parent on duty, I want the instructions next to my duty, so that I know what to do.

- **AC10.1.1** Given the information page, When any signed-in user opens it, Then they see its starting sections: "Reggeli teendők", "Délutáni, esti teendők", "Locsolás", "Szombati takarítás", "Állatok etetése és ápolása" and "Nagytakarítás" (with the fire warning, washing note and background).
- **AC10.1.2** Given a morning animal-care duty, When I follow its link, Then I reach the morning instructions.
- **AC10.1.3** Given the watering section, When it is outside March to October, Then it is not shown on a duty card.

### US10.2 Keep the page up to date (Should Have)

As a coordinator, I want to edit my group's section, so that it stays correct.

- **AC10.2.1** Given my group's section, When I edit it, Then the change is shown to everyone.
- **AC10.2.2** Given another group's section, When I try to edit it, Then it is refused; a super admin can edit every section.

## Group 11. Events

### US11.1 Create an event (Must Have)

As a coordinator or administrator, I want to create an event, so that the community can take part.

- **AC11.1.1** Given a super admin, When they create a community event with a start and an end, Then every parent can see it, including events lasting several weeks.
- **AC11.1.2** Given a coordinator, When they create an event for their group, Then it belongs to that group; for another group it is refused.
- **AC11.1.3** Given notices such as "bring your own cup and plate", When I add them, Then they appear at the top of the event.

### US11.2 Sign up with a note (Must Have)

As a parent, I want to sign up and say how I'll help, so that the organiser can plan.

- **AC11.2.1** Given an event, When I sign up with a note, Then my name and note are shown and it counts as my family's.
- **AC11.2.2** Given a task where the time matters, When I sign up, Then I can choose a date and time.
- **AC11.2.3** Given an event sign-up, When fair share is counted, Then it does not count.

### US11.3 Roles and the year's tale (Could Have)

As an organiser, I want to name the game master and record the year's tale, so that the festival can be run from the app.

- **AC11.3.1** Given an event, When I assign a role such as game master to a person, Then it shows on the event.
- **AC11.3.2** Given the year's tale in the free-text field, When the event is viewed next year, Then the tale is still with that event.
- **AC11.3.3** Given a station run by someone without an account, When I type their name, Then it is shown as the responsible person.

### US11.4 Offer food (Should Have)

As a parent, I want to offer food and see what others bring, so that we don't get ten cakes and no drinks.

- **AC11.4.1** Given the food sign-up, When I add an offer, Then I choose one of the eight categories, write what it is, and can tick milk, egg and garlic.
- **AC11.4.2** Given offers exist, When anyone opens the event, Then they see them with the ticks.
- **AC11.4.3** Given allergens are recorded, When they are stored or shown, Then they are about the ingredients only and are never linked to a child or family's health.

## Group 12. Checklists and templates

### US12.1 Work through a checklist (Must Have)

As a parent, I want to claim a checklist task and mark it done, so that the organiser can see what's left.

- **AC12.1.1** Given an event's checklist, When I claim a task, Then my name is shown on it.
- **AC12.1.2** Given a task someone else has claimed, When I try to claim it, Then I am told it is taken.
- **AC12.1.3** Given my claimed task, When I mark it done, Then the app records who and when.
- **AC12.1.4** Given a task has a tip, When I open it, Then I see the tip, such as never using the big ladder alone.

### US12.2 Manage templates (Must Have)

As an administrator or coordinator, I want to add, edit and remove templates, so that task lists aren't fixed.

- **AC12.2.1** Given a super admin, When they add or edit any template's name, sections, tasks and optional fields, Then the change is saved.
- **AC12.2.2** Given a coordinator, When they edit another group's template, Then it is refused.
- **AC12.2.3** Given a removed template, When an event is created, Then it is not offered; an administrator can restore it.
- **AC12.2.4** Given an event already created from a template, When the template is changed or removed, Then the event does not change.

### US12.3 Create an event from a template (Must Have)

As an organiser, I want to start an event from a template, so that I don't retype the list.

- **AC12.3.1** Given a template, When I create an event from it, Then the event gets its own copy, all tasks unclaimed.
- **AC12.3.2** Given a summer event, set by a "summer" option on the event, When the copy is made, Then "summer only" tasks are included; otherwise they are not.
- **AC12.3.3** Given a fresh install, When templates are listed, Then big cleaning, ship repair and each festival are there.

## Group 13. Organiser support

### US13.1 The organiser's list and reminders (Should Have)

As an organiser, I want the app to handle notices and chasing, so that I only need to step in when needed.

- **AC13.1.1** Given an event with an organiser's checklist, When a parent opens the event, Then they do not see that checklist.
- **AC13.1.2** Given a big cleaning with the default lead time, When it is two weeks away, Then every family gets a notice once.
- **AC13.1.6** Given an event where the organiser chose another lead time, When that time is reached, Then the people the event is for get the notice once, the whole community for a community event and the group's members for a working-group event.
- **AC13.1.3** Given a sign-up deadline, When parents open the event, Then it is shown, and three days before it the organisers are told about unclaimed tasks, once.
- **AC13.1.4** Given every task is marked done, When the organiser opens the event, Then it shows the closing round can start.
- **AC13.1.5** Given a family took rag rugs home, When it adds a note, Then the note can record how many.

## Group 14. Shared to-do list

### US14.1 Keep a to-do list (Must Have)

As a coordinator, I want a to-do list for my group, so that jobs don't get lost.

- **AC14.1.1** Given my group, When I add a task with topic, priority, description, tools and materials, status, note, "not before" date and deadline, Then it appears on the list.
- **AC14.1.2** Given another group's task, When I try to change it, Then it is refused.
- **AC14.1.3** Given a kitchen-garden task owned by the back-garden family, When a parent of that family opens it, Then they can claim it and update its status. An administrator names which family this is.

### US14.2 Browse and claim (Must Have)

As a parent, I want to browse open tasks and claim one, so that I can help.

- **AC14.2.1** Given open tasks, When I open the to-do list, Then done tasks and tasks with a future "not before" date are hidden by default.
- **AC14.2.2** Given a task, When I claim it and later mark it done, Then the app records who and when, and it stays in the history.
- **AC14.2.3** Given a teacher, When they open the list, Then they can read it and cannot change it.

### US14.3 Use tasks at a work day (Could Have)

As a coordinator, I want to pull to-do tasks into an event, so that a community work day has a list.

- **AC14.3.1** Given open tasks, When I pull them into an event, Then they appear on the event's checklist and keep their history.

## Group 15. My tasks

### US15.1 See only what's mine (Must Have)

As a parent, I want a page with only my family's duties and my claims, so that I can see at a glance what I must do.

- **AC15.1.1** Given my family holds duties and I claimed tasks, When I open "My tasks", Then I see those and no open tasks to browse.
- **AC15.1.2** Given I have nothing, When I open it, Then it says so and points to where I can help.

## Group 16. Lending library

### US16.1 Share and find books (Should Have)

As a parent, I want a list of the community's books, so that I can borrow them.

- **AC16.1.1** Given any user, When they add a book with title, authors, short description and owner, Then it is listed.
- **AC16.1.2** Given a book with no description, When it is listed, Then it is shown without a broken layout.

### US16.2 Borrow and return (Should Have)

As a parent, I want borrowing and returning to be recorded, so that we know where each book is.

- **AC16.2.1** Given an available book, When I borrow it, optionally with an "until when" date, Then it shows I have it.
- **AC16.2.2** Given a borrowed book, When its owner records the return, Then it shows as available.
- **AC16.2.3** Given someone other than the owner, When they try to record the return, Then it is refused.
- **AC16.2.4** Given two people borrow at the same moment, When both submit, Then one succeeds.

### US16.3 Get told when a book is back (Could Have)

As a parent, I want to be told when a book returns, so that I can borrow it next.

- **AC16.3.1** Given I asked to be notified, When the book is returned, Then I am notified once.
- **AC16.3.2** Given a leaving family holds a book, When it is 30 days before the changeover date, Then it gets one reminder to return it.

## Group 17. Reminders and notifications

### US17.1 Get reminders by email and in the app (Must Have)

As a parent, I want reminders in the app and by email, so that I don't miss a duty.

- **AC17.1.1** Given a reminder is due, When it runs, Then an in-app notice is created and an email is sent, checked against a local test mailbox in this work.
- **AC17.1.2** Given an email fails, When it has been tried at most 3 times, 15 minutes apart, Then the in-app notice remains and the failure is shown to the administrator.
- **AC17.1.3** Given a reminder has been sent, When the check runs again, Then it is not sent twice.
- **AC17.1.4** Given an email, When it is read, Then it contains no other family's contact details.
- **AC17.1.5** Given nobody has signed in for days, When a reminder falls due, Then it is still sent.
- **AC17.1.6** Given a to-do task, recurring duty, event or book, When a notice concerns it, Then the notice links to it.

## Group 18. One-off migration

### US18.1 Move the spreadsheet into the app (Must Have)

As an administrator, I want a script that loads the spreadsheet as it is, so that nothing is retyped.

- **AC18.1.1** Given the invented workbook with the real layout, When the script runs, Then the directory, the whole to-do list with done tasks, and the 14 books are loaded. Rotas are not migrated (Q4).
- **AC18.1.2** Given a bad row, When the script runs, Then it reports the row's position, carries on with the rest, and prints counts and never cell values.
- **AC18.1.3** Given the script has already run, When it runs again, Then nothing is duplicated.
- **AC18.1.4** Given a family written by a child's or first name, When a mapping is supplied, Then the row loads under the family name; without one, the row is reported.
- **AC18.1.5** Given the automatic checks, When they run, Then they use only the invented workbook.

## Group 19. Retiring the old import

### US19.1 Remove the old import (Should Have)

As an administrator, I want the old import gone, so that nothing maintains a workflow we replaced.

- **AC19.1.1** Given the new structure is in place, When anyone opens the old import address, Then the page is not found and its database functions no longer exist.

## Story Relationships

- US1.1 and US1.3 come before almost everything.
- US4.1 and US4.2 come before US5.1; US5.2 comes before US6.1 and US8.1.
- US9.2's done mark is reused by US12.1 and US14.2.
- US12.2 and US12.3 depend on US11.1.
- US17.1 is needed for the timed stories US6.2, US7.2, US7.3 and US13.1.

## INVEST Notes

Stories are sliced by behaviour and are independently testable, apart from the structural dependencies listed above. US5.1, US6.1 and US17.1 are the largest and may be split further in Functional Design.
