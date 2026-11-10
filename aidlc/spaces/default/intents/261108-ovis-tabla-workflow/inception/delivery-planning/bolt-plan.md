# Bolt Plan

A Bolt is one build pass over a piece of the work, ending in something that runs. There are 15 Bolts, one per unit in `unit-of-work.md`, built one at a time in unit-number order, which `unit-of-work-dependency.md` allows. Stories are mapped in `unit-of-work-story-map.md`, boundaries in `contract-summary.md` and `components.md`, screens in `mockups.md`, rules in `requirements.md` and `stories.md`, and how we work in `team-practices.md`.

## Definition of Done for Every Bolt

- The unit's stories meet their acceptance criteria.
- New screens were designed in Stitch first, and the owner has compared each built screen with its design using screenshots.
- Every database rule has the fixed test list: allowed, refused, out of reach, outdated screen, repeated click, two people at once.
- Application code keeps at least 80% line, branch and function coverage.
- `npm run verify:local` passes, and the pull request is squash-merged with a green `Validate` check.
- The owner has approved the Bolt at its checkpoint before the next one starts.

## Bolt Sequence

| Bolt | Unit | Marker | Size |
|---|---|---|---|
| B1 | U1 u1-community-foundation | Foundation for the thin slice | L |
| B2 | U2 u2-first-rota-slice | Thin first slice, owner check before the rest | L |
| B3 | U3 u3-directory-and-profile | | L |
| B4 | U4 u4-working-groups | | M |
| B5 | U5 u5-reminders-and-email | | M |
| B6 | U6 u6-full-rotas-and-weekend-picks | | L |
| B7 | U7 u7-swaps-and-duty-changes | | L |
| B8 | U8 u8-animal-care-and-information | | L |
| B9 | U9 u9-recurring-duties | | M |
| B10 | U10 u10-events-and-signups | | M |
| B11 | U11 u11-checklists-and-templates | | L |
| B12 | U12 u12-todo-and-my-tasks | | M |
| B13 | U13 u13-lending-library | | M |
| B14 | U14 u14-removal-and-anonymisation | | M |
| B15 | U15 u15-spreadsheet-migration | | M |

## Bolt Details

### B1 Community foundation (U1)

- **Extra done:** this is the owner's main worry, so before merge every row of `verification/authorization-matrix.json` is tested for the new roles, each of today's screens is walked through for every role, and the working-group admin is proven unable to reach another group, including by bypassing the screen.
- **Proves:** today's app works on one community without losing an access rule.
- **Demo:** sign in as each role on fresh invented data; today's screens work, and the six working groups are listed.

### B2 First rota slice (U2)

- **Extra done:** the owner checks the rota before B3 starts.
- **Proves:** the path from database to parent's screen works for a community-wide duty, and the fair draft is usable.
- **Demo:** set a school year and break weeks, draft indoor cleaning, change a week, publish, and see the duty as a parent.

### B3 Directory and profile (U3)

- **Proves:** field-level privacy holds in the database, not only on screen.
- **Demo:** two parents, one sharing and one not, seen as a parent and as a teacher.

### B4 Working groups (U4)

- **Proves:** self-service membership and coordinator rights work together.
- **Demo:** join a group, be appointed coordinator, leave, and lose the right at once.

### B5 Reminders and email (U5)

- **Proves:** reminders run with nobody signed in, once only.
- **Demo:** trigger the run locally; a notice and a test-mailbox email arrive; running it again sends nothing.

### B6 Full rotas and weekend picks (U6)

- **Proves:** all four rotas and the linked weekend rules hold, including the Wednesday and Friday-noon chasing.
- **Demo:** publish all rotas, pick a weekend slot, and trigger the chase for a family that didn't pick.

### B7 Swaps and duty changes (U7)

- **Proves:** a swap across any duty kinds respects rota rules and moves picks in one transaction.
- **Demo:** swap a week carrying a pick; try a swap that breaks the same-week rule; reverse one as an administrator.

### B8 Animal care and information (U8)

- **Proves:** fair share and empty-slot warnings replace the manual chasing.
- **Demo:** sign up, give up a slot, see the counts, and trigger the empty-slot warning; follow the duty card's link to the instructions.

### B9 Recurring duties (U9)

- **Proves:** repeating duties owned by groups, families or a rota week produce the right occurrences.
- **Demo:** bottle cleaning appears every fourth water week; mark a group round as done.

### B10 Events and sign-ups (U10)

- **Proves:** one event model serves community and group events.
- **Demo:** create an event, sign up with a note, add a food offer with allergen ticks.

### B11 Checklists and templates (U11)

- **Proves:** templates can be edited without changing existing events.
- **Demo:** create an event from a template, claim and finish a task, then edit the template and see the event unchanged.

### B12 To-do list and My tasks (U12)

- **Proves:** "My tasks" shows only what is mine across every kind of duty.
- **Demo:** claim a task, see it on My tasks, finish it, and find it in the history; open the coordinator page.

### B13 Lending library (U13)

- **Proves:** the library works with its return notices.
- **Demo:** add a book, borrow it, have the owner record the return, and get the "it's back" notice.

### B14 Removal and anonymisation (U14)

- **Proves:** removal reaches every kind of record and history stays readable.
- **Demo:** remove a parent and a family on invented data; the history shows "korábbi tag"; future duties and held books are flagged.

### B15 Spreadsheet migration (U15)

- **Extra done:** automatic checks use only the invented workbook. The owner's trial run needs the fixed anonymiser and the owner's check of it first.
- **Proves:** the script reads the real layout, and running it twice creates no duplicates.
- **Demo:** run it on the invented workbook twice; only counts are printed.
