# Requirements: match the app to the Ovis tábla workflow

Sources: `aidlc/spaces/default/knowledge/documents/ovis-tabla-tab-review.md` ("tab N", "appendix X"), `aidlc/spaces/default/knowledge/documents/ovis-tabla-gap-analysis.md` ("gap N", "decision N"), and `requirements-analysis-questions.md` ("Q N"). The current app is described in the code knowledge base (`business-overview.md`, `architecture.md`, `code-structure.md`); how we work is in `team-practices.md`. No `intent-statement` or `scope-document` exists for this work, because its plan has no ideation phase; the two approved documents above take their place. Contains no names or contact details.

## Intent Analysis

The parent community of a Waldorf kindergarten organises its shared work in one spreadsheet. The goal is for the app to do everything the community uses the spreadsheet for, and to remove the work the spreadsheet cannot do, above all chasing families by hand, so that the spreadsheet can be retired.

- **Type:** enhancement of an existing system; system-wide; complex.
- **Depth:** Standard.
- **What changes most:** the app moves from "kindergarten groups" to one family community plus working groups (decision 1). Business rules live in database functions (`architecture.md`), so most of the work is new database structure and rules, then screens.
- **Success:** every tab kept in scope has a working replacement in the app, on the owner's computer, with invented data. Actually retiring the spreadsheet also needs the separate hosting work (practices Q1).

## Functional Requirements

### FR1. Community and working-group structure (decision 1, gap 8)

- **FR1.1** The system shall have no kindergarten-group scope. The group records that exist today shall become the base for working groups.
- **FR1.2** Rotas, community events, the directory, the to-do list as a whole and the library shall belong to the whole community.
- **FR1.3** Working-group events and to-do tasks shall belong to one working group.
- **FR1.4** The system shall hold the six working groups for the 2026-2027 school year: Játszókert, Karbantartó, Ünnep-előkészítő, Kreatív-alkotó, Nagytakarítás szervezése and Állatgondozás, each with a name, a description and a school year (tab 12, appendix F).
- **FR1.5** The current group-admin role shall become the working-group admin, limited to its own working group (decision 1).
- **FR1.6** Teachers shall have read access to the whole community's working groups, members, events and tasks, not one group (tab 12).

### FR2. Working groups (tab 12, gap 8)

- **FR2.1** A parent shall be able to join and leave a working group themselves. Membership is per parent, optional, and a parent may be in several groups.
- **FR2.2** A super admin shall be able to grant and revoke the working-group admin role for a member of that group. A group may have more than one (Q8).
- **FR2.3** A working-group admin shall be able to manage that group's events, to-do tasks, recurring duties and templates, and nothing of another group.
- **FR2.4** Parents and teachers shall be able to see each working group's description and members. A member's name follows the directory rules of FR3.
- **FR2.5** A teacher's repair request reaches a working-group admin outside the app; the admin adds it as a to-do task (FR14). The app has no separate reporting flow (out of scope).

### FR3. Parent directory and own profile (tab 1, gap 1, decision 2)

- **FR3.1** Every signed-in user shall be able to open a directory of all parents.
- **FR3.2** A parent's "edit account" page shall have a tick box allowing their full profile to be shown to other parents. It is unticked until the parent ticks it.
- **FR3.3** Without the tick, other parents shall see only that parent's full name. With it, they shall see the name, children, phone, email, place of residence, occupation, hobby and how the parent supports the community.
- **FR3.4** Occupation, hobby and "how I support the community" shall be separate optional fields.
- **FR3.5** Teachers shall always see a parent's phone and email. The rest of the profile follows the tick box (Q9). Super admins see everything needed to administer the record.
- **FR3.6** A parent shall be able to edit their own details, change their own password while signed in, and change their own sign-in email. The email change shall confirm the new address before it takes effect (gap 1; today a database rule refuses every email change, `business-overview.md`).
- **FR3.7** An administrator shall be able to add parents with name, email and family, and add and remove families.
- **FR3.8** An administrator shall be able to send a parent an invitation from a screen (gap 1).
- **FR3.9** Family members shall be shown together, and a family's parents and children shall be identifiable as one family (tab 1).

### FR4. School calendar and joining or leaving (tabs 2 to 5, gap 2)

- **FR4.1** An administrator shall be able to record the school-break weeks of a school year in one place, used by every rota.
- **FR4.2** Each school year shall have a changeover date, 1 July by default, that an administrator can change (Q6).
- **FR4.3** A family shall be markable as leaving or new for a school year.
- **FR4.4** A leaving family shall not be assignable to a duty after the changeover date, and a new family shall not be assignable before it. This shall hold for planning, manual assignment, sign-up and swaps.

### FR5. Yearly rotas (tabs 2 to 4, gap 2)

- **FR5.1** The system shall support weekly rotas for indoor cleaning, front garden, water carrying and weekend animal care, one family per job per week.
- **FR5.2** Indoor cleaning and water carrying shall have no duty in school-break weeks. Weekend animal care shall run every weekend, including breaks. Front garden follows the school calendar as the administrator plans it.
- **FR5.3** The app shall propose a yearly draft in which each family gets about the same number of weeks, respecting school breaks and FR4.4 (Q1).
- **FR5.4** A family shall not hold indoor cleaning and front garden in the same week.
- **FR5.5** The administrator shall be able to change any week of the draft and then publish it. Parents see only published rotas.
- **FR5.6** Duties shall be shown by family name, never by a child's name (tab 2).
- **FR5.7** A duty week has no fixed day; the family completes it during its week. The duty text shall say so.
- **FR5.8** From March to October the front-garden duty shall include watering the front garden (tab 2).
- **FR5.9** The water-carrying duty shall state that the family fills all bottles at the end of its week (tab 4).

### FR6. Linked weekend duties (tab 3, gap 3)

- **FR6.1** A weekend shall have five duties: two openings, two closings and one shelter cleaning.
- **FR6.2** The families on indoor cleaning and front garden that week shall each pick one opening or closing; they cannot pick the shelter cleaning.
- **FR6.3** The weekend animal-care family shall do the shelter cleaning and every opening or closing the others did not take: two normally, three in a school-break week.
- **FR6.4** The system shall remind a family that has not picked on the Wednesday before the weekend. If it has not picked by Friday noon, the system shall notify an administrator, who assigns one (Q5).
- **FR6.5** The administrator and the families concerned shall be able to see who has picked and who has not.

### FR7. Daily animal-care sign-up (tab 5, gap 4)

- **FR7.1** The system shall offer a morning and an afternoon slot for every weekday, school breaks included, one family per slot.
- **FR7.2** Families shall sign up for free slots themselves.
- **FR7.3** The system shall show everyone how many slots each family has taken in the school year (Q3). Fair share applies only to these slots.
- **FR7.4** The system shall remind families below the average; it shall never block anyone (Q3).
- **FR7.5** Three days before an empty slot the system shall notify all families. One day before, it shall also notify the administrator and the Animal Care group's coordinators (Q4).
- **FR7.6** The system shall not record drop-off or pick-up.

### FR8. Duty visibility and swaps (cross-tab note, gap 2)

- **FR8.1** Every parent shall be able to see who holds which duty and when, across all rotas, by family name.
- **FR8.2** A parent shall be able to propose a swap with another family's future duty of any kind.
- **FR8.3** When both families agree, the swap shall apply at once without administrator approval. An administrator shall be able to see swaps and step in (Q2).
- **FR8.4** A swap that would break FR4.4 or FR5.4 shall be refused with a reason the parent can understand.
- **FR8.5** The swap and cancellation forms' reason shall be saved and shown to whoever decides the request (Q12).

### FR9. Recurring duties with a done mark (tabs 4, 7, 12, 14, gap 3)

- **FR9.1** The system shall support duties that repeat on a chosen interval, owned by a working group, a family, or the family on a given rota week.
- **FR9.2** A duty shall be markable as done, recording who and when.
- **FR9.3** Bottle cleaning shall be a recurring extra duty of the family on the water week, every fourth week by default, with the interval changeable (tab 4).
- **FR9.4** The periodic animal care of tab 7 shall be recurring duties owned by the Animal Care group. Rabbit items shall be switchable off while there are no rabbits.
- **FR9.5** The playground group's inspection round and the maintenance group's inspection round shall be recurring duties with intervals their groups can set (appendix F).
- **FR9.6** Seasonal repeating jobs from tab 14 (for example mowing, weeding, turning the compost) shall be recurring duties, not to-do tasks.

### FR10. Information and FAQ page (tabs 5, 7, 9, gap 6)

- **FR10.1** The app shall have an information page, readable by every signed-in user, with sections.
- **FR10.2** Super admins shall be able to edit every section, and working-group admins the sections their group owns.
- **FR10.3** A duty card shall link to the section that belongs to the duty.
- **FR10.4** The instructions shown for a duty shall follow its timing: morning, afternoon or evening, Saturday cleaning, and watering only from March to October (appendix A).
- **FR10.5** The page shall start with the content of appendices A and B and the general background from appendix D, and the fire warning and curtain-washing note from appendix C.

### FR11. Events (tabs 6, 8, 11, 13, gap 7)

- **FR11.1** A super admin shall be able to create community events, and a working-group admin that group's events.
- **FR11.2** An event shall have a start and an end date and may run for several weeks (tab 11).
- **FR11.3** A person shall be able to sign up and add a note saying how they contribute. The parent is recorded and shown and it also counts as their family's (Q7).
- **FR11.4** An event shall be able to carry notices shown at its top, such as "bring your own cup and plate" and an allergen notice.
- **FR11.5** An event shall be able to have roles, such as game master, each assigned to a person (tab 13).
- **FR11.6** An event shall have an optional free-text field for the year's tale, kept with that event (tab 13).
- **FR11.7** A food sign-up shall offer eight fixed categories: spreads, bread, free-from, savoury, sweet, drinks, vegetables/fruit, other. Each offer has free text and tick boxes for milk, egg and garlic (tab 13).
- **FR11.8** Everyone shall be able to see the offers already made.
- **FR11.9** Allergen information shall be about ingredients only, never linked to a child or family.
- **FR11.10** A task's responsible person may be typed as free text for someone without an account, such as an invited musician (tab 13).
- **FR11.11** A sign-up on a task shall be able to carry a chosen date and time, because some tasks depend on others (tab 9).
- **FR11.12** Event participation is voluntary and counts towards nothing.

### FR12. Checklists and templates (tabs 8, 9, 11, 13, gap 7)

- **FR12.1** An event shall be able to have a checklist with sections and tasks.
- **FR12.2** A person shall be able to claim a task, which acts as the sign-up, and mark it done; the system records who and when.
- **FR12.3** A task shall have a title and optional fields: place, props, priority 1 to 3, tools and materials, deadline, tip, and "summer only".
- **FR12.4** Super admins shall be able to add, edit and remove all templates, and working-group admins their own group's.
- **FR12.5** An event shall take its own copy of a template when created; later template edits or removal shall not change it.
- **FR12.6** "Summer only" tasks shall appear only in a summer event (tab 8).
- **FR12.7** Removing a template shall hide it from new events without losing it, so it can be restored (assumption A4).
- **FR12.8** The starting templates shall be big cleaning (with tips, appendices C and D), ship repair (appendix E) and one for each festival in appendix F, with the parents' and teachers' parts.

### FR13. Organiser support (tab 9, gap 7)

- **FR13.1** An event shall be able to have a separate organiser's checklist, visible to its organisers only.
- **FR13.2** The system shall be able to send a notice a chosen time before an event, two weeks by default for a big cleaning.
- **FR13.3** An event shall be able to have a sign-up deadline, shown to parents.
- **FR13.4** The system shall alert the organisers about unclaimed tasks as the deadline nears.
- **FR13.5** The organisers shall see when every task is marked done, the cue for the closing round.
- **FR13.6** A family's note on a task shall be able to record how many rag rugs it took home (tab 9).

### FR14. Shared to-do list (tab 14, gap 9)

- **FR14.1** The app shall have a to-do list separate from events.
- **FR14.2** A task's owner shall be a working group or one family; kitchen-garden and back-garden tasks are owned by the back-garden family.
- **FR14.3** A task shall have a topic, priority 1 to 3, description, tools and materials, a status of open, in progress, done or postponed, a note, an optional "not before" date, and an optional deadline.
- **FR14.4** The owner's admins shall be able to add and edit tasks.
- **FR14.5** Parents and teachers shall be able to see the list. A parent shall be able to claim a task and mark it done; the system records who and when.
- **FR14.6** Done tasks shall leave the default view and stay in the history.
- **FR14.7** A task with a future "not before" date shall stay out of the default view until that date.
- **FR14.8** An admin shall be able to pull to-do tasks into an event's checklist.

### FR15. My tasks (tab 14, gap 9)

- **FR15.1** A parent's "My tasks" page shall show only the duties assigned to their family and the tasks they claimed.
- **FR15.2** Open tasks to browse shall appear on their own pages, not on "My tasks".

### FR16. Lending library (tab 16, gap 10)

- **FR16.1** The app shall have a book list with title, authors, short description, owner and where the book is now.
- **FR16.2** Every user shall be able to add a book.
- **FR16.3** The borrower shall record borrowing, with an optional "until when" date. The owner shall record the return.
- **FR16.4** A person shall be able to ask to be told when a book is back, and shall be notified at the return.
- **FR16.5** A family marked as leaving that still holds a book shall get a reminder before the changeover date.

### FR17. Reminders and notifications (gap 4)

- **FR17.1** Reminders shall reach parents as in-app notices and by email (Q10).
- **FR17.2** Email shall be verifiable against a local test mailbox in this work; a real mail service is connected in the hosting work.
- **FR17.3** Timed reminders and alerts shall run without anyone signing in.
- **FR17.4** Notifications shall be able to concern to-do tasks, recurring duties, events and books, not only tasks (`business-overview.md`).

### FR18. One-off migration from the spreadsheet (decision 3, gap 11)

- **FR18.1** A script shall read the spreadsheet as it is laid out and load the directory, the to-do list with its done tasks, and the 14 books (appendix H).
- **FR18.2** The script shall live in the repository. Its automatic checks shall use only an invented workbook with the same layout (practices Q7, Q9).
- **FR18.3** Trial runs against the anonymised workbook happen on the owner's computer only, after the anonymiser is fixed and re-run and the owner has checked the result.
- **FR18.4** The script's output shall show counts, never cell values.
- **FR18.5** One bad row shall be reported by position and shall not stop the rest. Running the script twice shall not create duplicates.

### FR19. Retiring the old import (Q11)

- **FR19.1** Once the new structure replaces it, the import screen and its database functions shall be removed.

## Non-Functional Requirements

- **NFR1 Privacy.** No real person's name or contact details shall be in the repository, including tests and workflow records. Directory data shall be readable only as FR3 states, enforced in the database as well as on screens.
- **NFR2 Consent.** A parent's profile-sharing choice shall take effect at their next page load, and un-ticking shall hide the profile. The choice shall be recorded with its time.
- **NFR3 Authorization.** Every read and write of every new feature shall check the caller's right to that item on the database side. Rights revoked while signed in shall apply at the next request.
- **NFR4 Audit.** Role grants, sharing-consent changes, rota publishing, administrator interventions in swaps and migration runs shall be recorded in the audit log.
- **NFR5 Concurrency.** Two people acting on the same slot, task or book shall get the same result as acting one after the other, and a repeated click shall not create a duplicate.
- **NFR6 Testing.** Application code shall keep at least 80% line, branch and function coverage. Every database rule shall have the fixed test list: allowed, refused, out of reach, outdated screen, repeated click, two people at once (`team-practices.md`).
- **NFR7 Delivery checks.** Every change shall pass type checking, tests, production build, start smoke, the critical browser flow with no serious or critical accessibility violations, and dependency scanning.
- **NFR8 Language and screens.** All user-facing text shall be Hungarian. New screens shall be designed in Stitch first and shall work at phone width and by keyboard.
- **NFR9 Performance.** On invented data sized for 20 families and one school year, every list page shall load in under 2 seconds on the owner's computer.
- **NFR10 Email content.** Emails shall contain no other family's contact details.
- **NFR11 Leaving families.** The existing deletion and anonymisation of leaving families shall cover every new kind of record, and history shall stay readable with the person removed.

## Constraints

- Everything stays in the existing stack and the rule that database changes are forward-only (`architecture.md`, `code-structure.md`).
- This work ends with everything working on the owner's computer; hosting and loading real data are a separate piece of work (practices Q1). Nothing is deployed.
- The first delivered piece is one community-wide rota from the database to the parent's screen, which the owner checks before the rest is built (practices Q3).
- The real workbook never enters the repository. The anonymised copy is unusable until the anonymiser is fixed and re-run and the owner has checked the result. This narrows the wording in the original request, which said only the anonymised copy may be used for development; automatic checks now use an invented workbook (practices Q9).

## Assumptions

- **A1** Parents start with the sharing box unticked, so at go-live other parents see only full names until each parent ticks it. Reason: GDPR-safe default.
- **A2** Family names on rotas are visible to all parents whatever the tick box says. Reason: seeing whom to ask is the point of the rota (FR8.1), and a family name reveals no contact details.
- **A3** Teachers seeing phone and email (FR3.5) rests on the kindergarten's own need to reach parents. The kindergarten should confirm this with its privacy responsibilities in mind before go-live.
- **A4** "Remove" a template means hide and restorable (FR12.7). Reason: protects against mistakes.
- **A5** The bottle-cleaning interval of four weeks is the assistant's recommendation; the owner can change it (FR9.3).
- **A6** Parent cancellations keep today's flow, in which an administrator decides. Reason: nothing in the spreadsheet review asked to change it.
- **A7** Rota draft generation need not be optimal, only roughly even; the administrator corrects it.
- **A8** Where the migration finds a family name written as a child's or a first name, the owner corrects it by a mapping the script reads, kept outside the repository.

## Out of Scope

- Chat inside the app, problem reporting, money (tab 15, carpet-cleaning cost), the back-garden duty rota, the summer animal rota (tab 10), the water test (tab 17), drop-off and pick-up tracking.
- Hosting, a real mail service and loading real data (separate work).
- Fair-share counting of anything except weekday animal-care slots.

## Open Questions

- How timed reminders run with no scheduler in the app today (FR17.3): for design stages.
- How to record a fixed-list test case that has no meaning for a given rule, such as "two people at once" on a read-only rule: for test planning.
- How the invented workbook stays faithful to the real layout without personal data: for the migration design.
- Whether current-year rotas are migrated or planned anew at go-live: the gap analysis lists directory and rotas, while FR18.1 covers only what was agreed explicitly. To confirm before the migration is designed.
