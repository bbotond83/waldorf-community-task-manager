# Story to Unit Map

Every story in `stories.md` assigned to the units in `unit-of-work.md`. Requirements in `requirements.md` are reached through their stories. Component ownership comes from `components.md` and `decisions.md`.

## Story Map

| Story | Unit | Directory |
|---|---|---|
| US1.1 | U1 | u1-community-foundation |
| US1.2 | U1 | u1-community-foundation |
| US1.3 | U1 | u1-community-foundation |
| US2.1 | U4 | u4-working-groups |
| US2.2 | U4 | u4-working-groups |
| US2.3 | U4 | u4-working-groups |
| US2.4 | U12 | u12-todo-and-my-tasks |
| US3.1 | U3 | u3-directory-and-profile |
| US3.2 | U3 | u3-directory-and-profile |
| US3.3 | U3 | u3-directory-and-profile |
| US3.4 | U3 | u3-directory-and-profile |
| US3.5 | U3 | u3-directory-and-profile |
| US3.6 | U3; U14 | u3-directory-and-profile; u14-removal-and-anonymisation |
| US3.7 | U3 | u3-directory-and-profile |
| US4.1 | U2 | u2-first-rota-slice |
| US4.2 | U6 | u6-full-rotas-and-weekend-picks |
| US5.1 | U2; U6 | u2-first-rota-slice; u6-full-rotas-and-weekend-picks |
| US5.2 | U2 | u2-first-rota-slice |
| US5.3 | U2; U6 | u2-first-rota-slice; u6-full-rotas-and-weekend-picks |
| US5.4 | U7 | u7-swaps-and-duty-changes |
| US6.1 | U6 | u6-full-rotas-and-weekend-picks |
| US6.2 | U6 | u6-full-rotas-and-weekend-picks |
| US7.1 | U8 | u8-animal-care-and-information |
| US7.2 | U8 | u8-animal-care-and-information |
| US7.3 | U8 | u8-animal-care-and-information |
| US8.1 | U2 | u2-first-rota-slice |
| US8.2 | U7 | u7-swaps-and-duty-changes |
| US8.3 | U7 | u7-swaps-and-duty-changes |
| US9.1 | U9 | u9-recurring-duties |
| US9.2 | U9 | u9-recurring-duties |
| US9.3 | U9 | u9-recurring-duties |
| US9.4 | U9 | u9-recurring-duties |
| US10.1 | U8 | u8-animal-care-and-information |
| US10.2 | U8 | u8-animal-care-and-information |
| US11.1 | U10 | u10-events-and-signups |
| US11.2 | U10 | u10-events-and-signups |
| US11.3 | U10 | u10-events-and-signups |
| US11.4 | U10 | u10-events-and-signups |
| US12.1 | U11 | u11-checklists-and-templates |
| US12.2 | U11 | u11-checklists-and-templates |
| US12.3 | U11 | u11-checklists-and-templates |
| US13.1 | U11 | u11-checklists-and-templates |
| US14.1 | U12 | u12-todo-and-my-tasks |
| US14.2 | U12 | u12-todo-and-my-tasks |
| US14.3 | U12 | u12-todo-and-my-tasks |
| US15.1 | U12 | u12-todo-and-my-tasks |
| US16.1 | U13 | u13-lending-library |
| US16.2 | U13 | u13-lending-library |
| US16.3 | U13 | u13-lending-library |
| US17.1 | U5; U9; U10; U12; U13 | u5-reminders-and-email; u9-recurring-duties; u10-events-and-signups; u12-todo-and-my-tasks; u13-lending-library |
| US18.1 | U15 | u15-spreadsheet-migration |
| US19.1 | U1 | u1-community-foundation |

## Stories Spanning Units

Four stories span more than one unit.

| Story | How the work divides |
|---|---|
| US3.6 | U3 adds and removes the directory record. U14 extends removal to every other kind of record (AC3.6.2 and AC3.6.5 to AC3.6.7). |
| US5.1 | U2 drafts one rota. U6 adds the other three and the same-week rule. |
| US5.3 | U2 delivers the duty card for its rota. U6 adds the front-garden and water-carrying text. |
| US17.1 | U5 delivers the mechanism and the criteria that need no feature record. U9, U10, U12 and U13 each show AC17.1.1 and AC17.1.6 for their own kind of item: recurring duty, event, to-do task and book. |

Each unit on a spanning row traces all of that story's acceptance criteria in its Functional Design, marking the ones the other unit delivers.

## Implementation Order Within Units

Within every unit: database structure and rules with their tests first, then the application layer with its tests, then the Stitch design and screens with their browser checks (`team.md`, Testing Posture).

## Coverage

All 52 stories are assigned, and every unit from U1 to U15 has at least one row.
