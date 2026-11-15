# Ovis tábla: gap analysis against the current app

Compares the building blocks agreed in [ovis-tabla-tab-review.md](ovis-tabla-tab-review.md) with the app on
`main` as of 2026-11-07 (screens under `app/`, database functions under `supabase/migrations/`, roles in
`src/access/role-policy.ts`). Contains no names or contact details.

Legend: **Have** = works today · **Partly** = a base exists but the agreed behaviour is missing · **Missing** = not
in the app.

## What the app has today, in short

- **Roles:** parent (one family), group admin and kindergarten teacher (one kindergarten group each), super admin
  (the whole organisation). "Group" here means a kindergarten group (class), not a working group.
- **Directory (admin side):** school years, groups, families, parents with email, phone and place of residence,
  children, one free-text optional profile with consent, group memberships that can end, archiving and restoring.
- **Tasks and events:** an admin creates tasks one at a time (title, category, start and end, place, number of places)
  and events (title, place, free-text coordinator name, start and end, allergen, supply and food notes); a task can
  belong to an event. Tasks can also be imported from the workbook template.
- **Parents:** see the tasks of their group and their own places, sign up for a free place, write a note on their own
  place (up to 500 characters), ask to swap with another family's place on any other open future task of the same
  group (any category), ask to cancel, see incoming swap requests and notifications.
- **Admin:** approvals for swaps and cancellations, assign and remove places, reminder jobs (one week before and the
  day before, delivery simulated), reminder and role settings, data lifecycle (deleting data of leaving families),
  archive, workbook import with preview and rollback.
- **Teacher:** a read-only schedule of their groups.
- **Identity:** sign-in, sign-out, password reset by email, invitation acceptance page (no screen sends invitations).

## Gap by building block

### 1. Parent directory and self-service profile (tab 1)

| Need | Status | Notes |
|---|---|---|
| Admin adds parents with name, email and family | Have | Records screens (`/admin/nyilvantartasok`) |
| Every user sees everyone's contact details, children, occupation, interests, place of residence and how they support the community | Missing | No directory page for parents or teachers; today a profile is visible only to the parent and the admin |
| Separate fields for occupation, hobby, how I support the community | Partly | One free-text optional profile (500 characters) with one consent flag |
| Parents edit their own details | Missing | No "my details" page |
| Parents change their own email and password | Partly | Password only through the "forgotten password" email; no email change |
| Consent for showing contact details to all parents | Missing | Consent exists only for the optional profile; needs a per-field or overall sharing consent (GDPR) |
| Invitations sent from a screen | Missing | The library and the acceptance page exist; no admin screen sends them |

### 2. Year-long weekly rotas (tabs 2, 3, 4)

| Need | Status | Notes |
|---|---|---|
| A duty with one family for a week | Partly | A task with one place and a week-long start/end works, but each week must be created one by one |
| Admin plans a whole school year at once (weeks, jobs, families) | Missing | No rota or bulk planning; the import can load rows, but only from the workbook template |
| School-break weeks shared by all rotas | Missing | No school calendar; school years have only start and end dates |
| Assign by family name | Have | Places belong to families |
| 1 July rule: leaving families not after, new families not before | Missing | Memberships can end, but there is no planned leaving or joining date and no check when assigning |
| Swap between families, also across kinds of duty | Have | Swap candidates are any other family's place on another open future task of the same group |
| Parents see who is on which duty, to know whom to ask | Missing | A parent sees other families' names only inside the swap partner list; the task list shows only their own place |

### 3. Linked weekend duties (tab 3)

| Need | Status | Notes |
|---|---|---|
| Five weekend duties per week (two openings, two closings, shelter cleaning) | Partly | Could be five tasks per weekend, created by hand |
| The week's indoor-cleaning and front-garden families must each pick one opening/closing | Missing | No rule linking duties of one week, no "pick one, mandatory" sign-up, no view of who has not picked |
| The weekend family covers the rest (three in a school-break week) | Missing | Depends on the two items above |

### 4. Daily sign-up rota with fair share (tab 5)

| Need | Status | Notes |
|---|---|---|
| Morning and afternoon slots every day, families sign up | Partly | Sign-up works per task, but about 500 weekday slots a year would have to be created one by one |
| Fair share: each family contributes about evenly | Missing | No per-family count or balance view |
| Alert when a slot is unfilled, so nobody chases by hand | Missing | Reminders go to families already on a task; nothing warns about empty slots |
| Real reminder delivery | Partly | Reminders are planned and simulated; no email or push is sent |

### 5. Recurring duties with a done mark (tabs 4, 7, 12, 14)

| Need | Status | Notes |
|---|---|---|
| A duty that repeats (every four weeks, monthly, quarterly, yearly, seasonally) | Missing | No recurrence |
| Mark a duty as done, with who and when | Missing | Places have no completion state; status values are active, swap/cancellation pending, removed |
| Owned by a working group (animal care, playground, maintenance) | Missing | No working groups (see 8) |

### 6. Information / FAQ page (tabs 5, 7, 9)

| Need | Status | Notes |
|---|---|---|
| Editable information page (animal care, feeding, big-cleaning background) | Missing | No content pages |
| Link from a duty card to the matching part | Missing | |
| Season-dependent instructions (watering March to October) | Missing | |

### 7. Events with checklists, templates and sign-up categories (tabs 6, 8, 9, 11, 13)

| Need | Status | Notes |
|---|---|---|
| Events with date range, place, notes | Have | Events have start/end, place, allergen, supply and food notes |
| Tasks inside an event, sign-up, a note per sign-up | Have | Tasks can belong to an event; a family can add a note to its place |
| Events created by a working-group admin for their group | Missing | Group admins exist only for kindergarten groups |
| Community-wide events | Partly | Events and tasks always belong to one kindergarten group; with one group this works, with several it does not |
| Checklist template, copied into each event | Missing | No templates |
| Admins can add, edit and remove templates in the app: name, sections, tasks and optional task fields | Missing | Replaces today's editing of the task lists in the spreadsheet. Super admins manage all templates; working-group admins manage their own group's templates (agreed for tab 8) |
| Editing or removing a template leaves events already created unchanged | Missing | Follows from each event taking its own copy |
| Starting templates loaded at go-live: big cleaning, ship repair, summer festival and the other festivals | Missing | Content is in appendices C, D, E and F of the tab review |
| Claim a checklist item and tick it done, with who and when | Partly | Signing up for a place is a claim; there is no done mark |
| Summer-only items | Missing | |
| Optional task fields: props, priority, tools and materials | Missing | Tasks have title, category, place, time and number of places only |
| Roles on an event (game master) and the year's tale | Partly | One free-text coordinator name; no role assignment, no tale field |
| Responsible person outside the app (invited musician) | Missing | Places belong to families |
| Food sign-up with eight fixed categories and allergen tick boxes | Missing | Only a free-text note per place and event-level notes |
| Everyone sees the offers already made | Missing | Parents see only their own place |
| Organiser checklist, notice two weeks before, sign-up deadline, alerts on unclaimed items, "all done" cue | Missing | Reminders exist only per task for assigned families |
| Sign-up with a date and time chosen by the volunteer | Missing | The task's time is fixed |
| Not counted towards fair share | Have | No fair share exists today |

### 8. Working groups (tab 12)

| Need | Status | Notes |
|---|---|---|
| Six working groups for 2026-2027 with description and school year | Missing | |
| Parents join and leave groups themselves, several allowed | Missing | |
| Elected coordinator acting as working-group admin | Missing | A new role scoped to a working group, separate from the kindergarten-group admin |
| Teachers see groups, members, events and tasks | Partly | Teachers see a read-only schedule of their kindergarten group |
| Teachers pass repair requests to the working-group admin, who adds the task | Missing | Outside the app for now (agreed); the admin side of adding the task depends on 9 |

### 9. Shared to-do list and "My tasks" (tab 14)

| Need | Status | Notes |
|---|---|---|
| A to-do list separate from events, owned by a working group or one family | Missing | |
| Fields: topic, priority, description, tools and materials, status (open, in progress, done, postponed), note, "not before" season, deadline | Missing | |
| Parents claim a task and mark it done; history kept | Missing | |
| "My tasks" shows only my assigned duties and claimed tasks | Partly | The parent task list mixes open tasks of the group with the family's own places |
| Load the full list from the spreadsheet, done tasks included | Missing | The import knows only directory and task sheets |

### 10. Lending library (tab 16)

| Need | Status | Notes |
|---|---|---|
| Book list (title, authors, description, owner, where it is now), anyone adds books | Missing | |
| Borrower records borrowing, owner records the return | Missing | |
| Optional "until when" date and "notify me when it is back" | Missing | Notifications exist and could carry the notice |
| Load the 14 books | Missing | |

### 11. Migration from the spreadsheet

| Need | Status | Notes |
|---|---|---|
| Import of directory and rotas | Partly | The import reads a fixed template (one directory sheet, seven task sheets, nine archive sheets) that the owner must fill in by hand; the agreed tabs and decisions no longer match it (for example tab 10 and 17 ignored, tab 14 and 16 needed) |
| Import of the to-do list and the library | Missing | |

## Already in place and reusable

- Families, parents, children, groups, school years, memberships, archiving: the base for the directory and the 1 July
  rule.
- Tasks, events, places, sign-up, notes on places, swaps across task kinds, cancellations, approvals: the base for
  rotas and events.
- Notifications and reminder jobs: the base for unfilled-slot alerts, deadline notices and "the book is back".
- Audit log, idempotency, row-level security and privacy rules: every new feature can follow the same patterns.

## Biggest gaps, roughly in order of how much they unblock

1. **Visibility for parents:** a shared duty overview (who has what, when) and the parent directory. Both are the
   main reasons the spreadsheet is used and both need a privacy decision (consent for contact details).
2. **Rota planning:** a school calendar with break weeks, bulk creation of weekly and daily rotas, the 1 July rule,
   and the linked weekend duties.
3. **Done marks and recurring duties:** completion with who and when, and repetition. Needed by the to-do list,
   checklists, periodic animal care, bottle cleaning and inspection rounds.
4. **Working groups and the working-group admin role.**
5. **Event checklists and templates**, including screens for admins to add, edit and remove templates, sign-up
   categories with allergen tick boxes, roles such as game master.
6. **Shared to-do list** with "My tasks" kept separate.
7. **Information/FAQ page.**
8. **Lending library.**
9. **Real reminder delivery and unfilled-slot alerts.**
10. **Migration** of the directory, rotas, to-do list and books into the new structure.

## Decisions on the open points (owner, 2026-11-07)

1. **Scope:** kindergarten groups make no sense for this community. There is the family community as a whole and the
   working groups. The groups that exist in the app today become the base for working groups. Rotas, community events,
   the directory and the library belong to the whole community; working-group events and to-do items belong to a
   working group. The kindergarten-group admin role becomes the working-group admin.
2. **Contact sharing:** the parent's "edit account" page gets a tick box that allows their full profile to be shown
   to other parents. Without it, other parents see only the full name.
3. **Migration:** a one-off migration (option B below). A script reads the current spreadsheet as it is and loads it at
   go-live; the owner runs it on their own computer. Its automatic checks use an invented workbook in the repository; the
   owner-checked anonymised copy is used for trial runs on the owner's computer only.
   Whether the existing import screen (`/admin/import`) is then removed is decided during planning.
4. **Version 1:** every gap identified in this document is in version 1 (chat and problem reporting stay out, as
   agreed earlier).

## Migration options (B chosen)

- **A. Keep the import screen:** an admin uploads a workbook in a fixed template, as today. It can be reused, but the
  owner must first copy the data into the template by hand, and the template and its code must be kept in step with
  every change of the app.
- **B. One-off migration:** a script, written once, reads the current spreadsheet and loads the data into the app at
  go-live. The owner runs it on their own computer, so the real data never leaves it. Afterwards the spreadsheet is
  retired and no import screen is needed.
- **C. Manual entry:** administrators type the data in. Feasible for the small volume (about 15 families, about 50
  to-do items, 14 books), but slow and error-prone for the to-do history.
