# Units of Work

The work in `requirements.md` and `stories.md` is cut into 15 feature-area units, following the components in `components.md` and the decisions in `decisions.md`, and the answers in `units-generation-questions.md` (Q1 to Q4). Unit numbers are identifiers only; the build order is set in Delivery Planning. Contains no names or contact details.

## Unit Overview

| Unit ID | Directory | Purpose | Kind | Deployment | Complexity |
|---|---|---|---|---|---|
| U1 | u1-community-foundation | One community and working groups replace kindergarten groups | service | shared | L |
| U2 | u2-first-rota-slice | School calendar and one rota from database to parent's screen | service | shared | L |
| U3 | u3-directory-and-profile | Directory, sharing choice, own details, invitations | service | shared | L |
| U4 | u4-working-groups | Membership and coordinators | service | shared | M |
| U5 | u5-reminders-and-email | Reminders by notice and email, the daily run | service | shared | M |
| U6 | u6-full-rotas-and-weekend-picks | All four rotas, changeover rule, weekend picks | service | shared | L |
| U7 | u7-swaps-and-duty-changes | Swaps, cancellations, reassignment | service | shared | L |
| U8 | u8-animal-care-and-information | Daily slots, fair share, information page | service | shared | L |
| U9 | u9-recurring-duties | Repeating duties and done marks | service | shared | M |
| U10 | u10-events-and-signups | Events, sign-ups, roles, food offers | service | shared | M |
| U11 | u11-checklists-and-templates | Event checklists, templates, organiser support | service | shared | L |
| U12 | u12-todo-and-my-tasks | Shared to-do list, My tasks, coordinator page | service | shared | M |
| U13 | u13-lending-library | Books, borrowing, return notices | service | shared | M |
| U14 | u14-removal-and-anonymisation | Removing people and families across all new records | service | shared | M |
| U15 | u15-spreadsheet-migration | One-off load from the spreadsheet | (none) | standalone script | M |

"Shared" means the unit ships inside the one existing application and database (`team.md`, Deployment); nothing is deployed in this work. U15 has no kind because it is a one-off script, neither part of the running app nor reusable code.

## Unit Definitions

### U1 u1-community-foundation

- **Owns:** the switch to one community (ADR-001): group records become working groups, the six working groups, the group-admin role limited to one working group, teachers reading across the community, removal of the old import (ADR-009).
- **Components:** Platform, Identity, Community, WorkingGroups, WebApplication.
- **Boundary:** the app keeps working with today's screens on the new structure. No new feature screens beyond the working-group list.
- **Notes:** the riskiest change, because every access helper and many tests change. It starts clean with fresh invented data (US1.1). The role change updates the grant constraint, reach helpers, `role-policy.ts`, `authorization.ts`, navigation and `verification/authorization-matrix.json` together (`team.md`). Open question for test planning: how to record a fixed-list test case that has no meaning for a rule.

### U2 u2-first-rota-slice

- **Owns:** school year and break weeks, the shared Duty and Place model (ADR-002), one rota (indoor cleaning): draft, adjustment, publishing, duty card, duty overview.
- **Components:** Community, Duties, RotaPlanning, WebApplication.
- **Boundary:** one rota only, and only break-week rules. Notifying families on publishing uses today's in-app notices; U6 moves it onto the new Notifications function.
- **Notes:** this is the agreed thin first slice, which the owner checks before the rest is built.

### U3 u3-directory-and-profile

- **Owns:** the directory and its field-level visibility (ADR-008), the sharing tick box and its audit record, own details, password and email change, adding families and parents, invitations.
- **Components:** Identity, Community, WebApplication.
- **Boundary:** removal here covers the directory record itself. Reaching every other kind of record belongs to U14.
- **Notes:** the main privacy control, covered by the fixed test list. The email change replaces today's blanket refusal.

### U4 u4-working-groups

- **Owns:** joining and leaving, seeing members under the directory rules, appointing and revoking coordinators.
- **Components:** WorkingGroups, Identity, WebApplication.
- **Boundary:** the coordinator's management page is in U12, once all four things it manages exist.
- **Notes:** when a membership ends, WorkingGroups asks Identity to end the admin grant (ADR-010).

### U5 u5-reminders-and-email

- **Owns:** in-app notices and email for every kind of item, delivery attempts and failures, the daily run (ADR-006, ADR-007).
- **Components:** Notifications, TimedChecks, WebApplication.
- **Boundary:** the mechanism only. Each feature unit adds its own "what is due" check.
- **Notes:** run 07:00 Budapest time, with a Friday-noon run. Locally a command triggers it, and it must not be callable by users. Email is verified against a local test mailbox. Defaults from `stories.md`: 3 tries, 15 minutes apart.

### U6 u6-full-rotas-and-weekend-picks

- **Owns:** front garden, water carrying and weekend animal care rotas, the same-week rule, leaving and new families, weekend picks and chasing (ADR-004).
- **Components:** Community, RotaPlanning, Duties, TimedChecks, WebApplication.
- **Boundary:** changing a published duty is in U7.
- **Notes:** Wednesday reminder, Friday-noon alert to an administrator. Moves U2's rota-publishing notice onto the Notifications function from U5.

### U7 u7-swaps-and-duty-changes

- **Owns:** swaps between any kinds of duty, reasons, cancellations, administrator reassignment and reversal, swap expiry (ADR-011).
- **Components:** DutyChanges, RotaPlanning, Duties, TimedChecks, WebApplication.
- **Boundary:** existing swap functions move into DutyChanges.
- **Notes:** the rota rules and pick adjustment run in one database transaction. A swap expires when the earlier duty starts. Functional Design names the requester field on a swap request and lists it with `decidedBy` as cleared on removal.

### U8 u8-animal-care-and-information

- **Owns:** morning and afternoon slots, sign-up, giving up a slot until 24 hours before (ADR-012), fair-share counts and reminders, empty-slot warnings, the information page and its links from duty cards.
- **Components:** AnimalCareSignup, DutyChanges, Information, TimedChecks, WebApplication.
- **Boundary:** the two feature areas are one unit because the first instructions are the animal-care ones.
- **Notes:** Functional Design adds the acceptance criteria for giving up a slot, which are not yet in `stories.md`.

### U9 u9-recurring-duties

- **Owns:** repeating duties owned by a group, a family or the family on a rota week, done marks, bottle cleaning, the groups' regular care, seasonal jobs.
- **Components:** RecurringDuties, RotaPlanning, Duties, TimedChecks, WebApplication.
- **Boundary:** the done-mark pattern is repeated on each record (ADR-003), so no shared unit is needed.

### U10 u10-events-and-signups

- **Owns:** community and working-group events, notices, sign-ups with a note, roles, the year's tale, food offers.
- **Components:** Events, Duties, WebApplication.
- **Boundary:** checklists are in U11.
- **Notes:** allergen ticks describe ingredients only. Signing up for an event task applies the leaving or new family rule from U6.

### U11 u11-checklists-and-templates

- **Owns:** event checklists, claiming and done marks, templates with add, edit, hide and restore (ADR-005), organiser's checklist, lead-time notice, sign-up deadline, unclaimed-task alert.
- **Components:** Checklists, Events, TimedChecks, WebApplication.

### U12 u12-todo-and-my-tasks

- **Owns:** the shared to-do list with history, pulling tasks into a checklist, the My tasks page, the coordinator's management page.
- **Components:** TodoList, Checklists, Duties, WebApplication.

### U13 u13-lending-library

- **Owns:** book list, borrowing and return, return notices, the reminder to leaving families.
- **Components:** Library, TimedChecks, WebApplication.

### U14 u14-removal-and-anonymisation

- **Owns:** removing a parent or family across every new kind of record; history shown as "korábbi tag"; flagging future duties, held books and claimed tasks for an administrator.
- **Components:** Lifecycle, WebApplication.
- **Notes:** Functional Design settles removing a family's only parent or a group's coordinator. Decided swap requests clear both the requester and the person who decided.

### U15 u15-spreadsheet-migration

- **Owns:** the one-off script loading the directory, the to-do list with done tasks and the 14 books (ADR-009).
- **Components:** SpreadsheetMigration.
- **Notes:** automatic checks use only an invented workbook. Output is counts only. The owner's trial runs need the anonymiser fixed and re-run outside the repository and the result checked by the owner. Rotas are not migrated.

## Constraints for Every Unit

- Database changes are new forward-only migrations, and each new database test file is added to its `test:database:*` script and to the shuffled run (`team.md`).
- New screens are designed in Stitch first and compared with that design in the owner's screenshot review.
- Every database rule gets the fixed test list. Application code keeps at least 80% coverage.
- Screens are Hungarian and work at phone width and by keyboard.
- No real person's name or contact details enter the repository.
