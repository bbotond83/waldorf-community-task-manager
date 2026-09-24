# Rough Wireframes

Upstream artifacts: `intent-statement.md`, `scope-document.md`, `intent-backlog.md`.

## Parent: Saját feladataim

## Authentication and Role Routing
```text
+---------------------------+
| Bejelentkezés             |
| Email [____________]      |
| Jelszó [____________]     |
| [Belépés]                 |
| Error: hibás belépési adat|
+---------------------------+
```
After successful sign-in, route Parent to My Tasks, read-only staff to Group Schedule, group admin to assigned-group Coordination, kindergarten admin to Dashboard, and super admin to Dashboard/Settings. Unauthorized direct-route access shows `Nincs jogosultság` with no sensitive data.

```text
+--------------------------------+
| Skip | Saját feladataim         |
| [Upcoming task] [Date]         |
| Status: Available              |
| [Jelentkezem] [Csere] [Lemond] |
| Értesítések                    |
+--------------------------------+
```

`<main aria-labelledby="my-tasks">` → H1 `Saját feladataim` → upcoming cards (task, date, family assignment, status) → primary Sign up / Swap / Cancel actions. Swap auto-confirms between parents; cancellation shows approval-pending status; reminders show 7-day and 24-hour schedule. Keyboard entry begins at Skip to content; cards have visible focus.

Screen states: available/full signup; confirmation/error feedback; no eligible swap counterpart; swap accepted/declined; cancellation pending/approved/rejected. Notification panel shows upcoming reminders and change outcomes.

### Assignment Detail

```text
+--------------------------------+
| Feladat neve                   |
| Család: Kovács család          |
| Kapacitás: 1 hely              |
| [Jelentkezem] [Csere] [Lemond] |
| Visszajelzés / hibaüzenet      |
+--------------------------------+
```

`<main>` H1 task name → family ownership and eligibility → capacity (`available`/`full`) → status → Sign up, Swap, or Cancel actions → inline confirmation/error. Landmark: `main`; keyboard entry: Skip to content; all status changes announced with accessible Hungarian text.

## Admin: Coordination

```text
+--------------------------------+
| Koordináció | Irányítópult     |
| [Feladatok] [Események]        |
| [Hozzárendel] [Jóváhagy]       |
| [Excel import] [Archívum]      |
+--------------------------------+
```

`<nav>` role-aware menu → `<main>` H1 `Koordináció` → task/event table → assignment and approval controls → reminder history → Import Excel. Import flow: upload → column-mapping preview → validation errors → confirm import. Contact details are admin-only; form controls have labels and keyboard focus.

Screen inventory: Dashboard; Families/children/group/school-year records; Tasks/events; Assignments and approvals; Archive; Import preview. Super-admin adds organization settings, roles, and family membership administration.

Each admin screen uses `<main>` with an H1 matching its screen name, a `<nav>` landmark, and Skip-to-content keyboard entry: Dashboard, Records, Tasks and events, Assignments and approvals, Archive, Import preview, and Settings. `Értesítések` likewise uses `<main>`, H1 `Értesítések`, and Skip-to-content entry.

Role boundaries: Super admin manages organization settings, all roles, and family membership; kindergarten admin manages kindergarten-wide records, tasks/events, assignments, approvals, and import; group admin sees and manages only assigned groups’ tasks/events and assignments, with no organization settings or cross-group data.

| Route | Super | Kindergarten | Group admin | Parent | Read-only staff |
| --- | --- | --- | --- | --- | --- |
| Dashboard/records/tasks/assignments/import/archive | Allow | Allow | Assigned groups only | Deny | Deny |
| Settings/roles/membership | Allow | Deny | Deny | Deny | Deny |
| My Tasks/Notifications | Allow when assigned | Allow when assigned | Allow when assigned | Allow | Deny |
| Group schedule | Allow | Allow | Assigned groups only | Deny | Allow, read-only |

## Required States

| Screen | Empty/loading/permission/action states |
| --- | --- |
| My Tasks | No tasks; loading skeleton; unavailable/full signup; signup confirmation/error; swap and cancellation forms with outcome status. |
| Assignment Detail | Missing assignment; loading; family-ownership warning; full capacity; no eligible swap; pending/approved/rejected cancellation. |
| Admin Coordination | Empty task list; loading; role-denied page; assignment/approval forms with validation and success/error feedback. |
| Import | Empty upload; parsing/loading; invalid-column and row-validation errors; mapping-confirmation success. |
| Records/Archive/Settings | Empty list; loading; permission-denied state; create/edit forms with field errors and confirmation. |

## Route Layouts

```text
Records: H1 Nyilvántartások -> group filter -> mobile cards (family/child/group/year) -> [Add]
Tasks/Events: H1 Feladatok -> group/date filter -> cards (capacity/status) -> [Create]
Approvals: H1 Jóváhagyások -> pending cards -> [Approve] [Reject] -> confirmation
Archive: H1 Archívum -> search/filter -> read-only cards
Import: H1 Import -> [Upload] -> mapping rows -> validation list -> [Confirm]
Settings: H1 Beállítások -> organization/roles/members sections -> [Save]
Notifications: H1 Értesítések -> reminder/change cards -> read status
Staff Schedule: H1 Csoport naptár -> group/date -> event cards; no names, contacts, or actions
```

### Records
```text
+---------------------------+
| Nyilvántartások [Group v] |
| [Search]                  |
| Family | Children | Group |
| [Edit] (admin only)       |
| Empty: Nincs találat      |
| Loading: skeleton cards   |
| Denied: Nincs jogosultság|
+---------------------------+
```

### Task, Approval, Import
```text
+---------------------------+
| Feladatok [Group v][Add] |
| Task | Date | Capacity   |
| [Open] [Assign]          |
| Jóváhagyások: [Approve]  |
| [Reject + reason]        |
| Import: file -> mapping  |
| row errors -> [Confirm]  |
+---------------------------+
```

### Reminder Monitoring
```text
+---------------------------+
| Emlékeztetők [Group v]    |
| Task | due | 7d | 24h     |
| Delivered | failed          |
| Empty: nincs emlékeztető  |
| Error: delivery hiba      |
+---------------------------+
```
Allowed to super, kindergarten, and assigned-group admins only. Shows task, group, due date, reminder type and delivery state; never email address or phone number.

### Admin Dashboard
```text
+---------------------------+
| Irányítópult [Group v]    |
| Pending approvals: 3 [Open]|
| Upcoming tasks: 5 [Open]  |
| Reminder failures: 1[Open]|
| Import status: ready      |
| [Create task]             |
+---------------------------+
```

### Approval Detail
```text
+---------------------------+
| Lemondási kérelem         |
| Task | date | group        |
| Family | reason            |
| [Jóváhagy] [Elutasít]     |
| Reject reason [________]  |
| Validation/outcome message|
+---------------------------+
```

### Task/Event Editor
```text
+---------------------------+
| Új feladat / esemény      |
| Title [____________]      |
| Group [v] Date/time [__]  |
| Capacity [__] Details [_] |
| [Mentés] [Mégse]          |
| Field errors / saved toast|
+---------------------------+
```
Authorized kindergarten admin or assigned-group admin only; unauthorized access shows denied, invalid fields show Hungarian inline errors.

### Assignment Form
```text
+---------------------------+
| Hozzárendelés             |
| Task [v] Family [v]       |
| Eligibility/capacity      |
| [Hozzárendel] [Mégse]     |
| Full/ineligible/error msg |
| Confirmation on success   |
+---------------------------+
```
Group admins may assign only within their group; kindergarten and super admins may assign all groups.

### Staff Event Detail
```text
+---------------------------+
| Esemény részletei         |
| Title | date/time          |
| Location | notes           |
| [Back to schedule]        |
| no assignments/contacts   |
+---------------------------+
```

### Archive, Settings, Notifications, Staff
```text
+---------------------------+
| Archívum [Search]        |
| Record | Date | [Open]   |
| Settings: org/roles/save |
| Notifications: type/date |
| Staff: Event | date/time |
| location | notes         |
| (no family/name/contact) |
+---------------------------+
```

Group admin context is fixed to their assigned group; cross-group rows and Settings are unavailable. Super admin can edit roles/members; kindergarten admin can edit organization-wide operations, but not super-admin role governance.

### Parent Operational Screens
```text
+---------------------------+
| Saját feladataim          |
| Loading: [-----] [-----]  |
| Empty: Nincs feladat      |
| Swap: [Parent v] [Send]  |
| Accept? [Igen] [Nem]     |
| Cancel reason [_______]  |
| [Küldés] Pending/Outcome |
+---------------------------+
```

Action rules: Available task shows `Jelentkezem` only; full task shows no signup action and a full message; family-assigned task shows `Csere` and `Lemond`; swap-pending shows request status and disables new swap; cancellation-pending shows status and disables new cancellation.

Swap handoff: requesting parent selects a counterpart and sends; requester sees `Csere kérése elküldve`. The selected counterpart receives an `Értesítések` card with task/date/requesting family and `[Elfogad] [Elutasít]`; acceptance auto-approves and both parents receive outcomes.

On acceptance, family ownership transfers to the counterpart family and both My Tasks cards refresh. If eligibility or capacity changed before acceptance, the request is invalidated, neither assignment changes, and both see an error; decline leaves the original assignment unchanged.

Cancellation approval card: request type, task/date, requesting family, reason, current status, `[Jóváhagy] [Elutasít]`, rejection-reason field, validation/error feedback, and final notification outcome.

Kindergarten admins may approve/reject all cancellation requests; group admins may approve/reject only their assigned groups; super admins may approve/reject all. Approval releases the assignment; rejection keeps it family-owned; both outcomes notify the requesting family.

All routes use mobile-first single-column cards before optional desktop tables; H1, main landmark, Skip link, visible focus, loading skeleton, empty message, and permission-denied state.

```text
Parent change states: [Csere] -> counterpart list / "Nincs elérhető csere" -> accept / decline -> result.
[Lemond] -> reason textarea -> [Küldés] -> pending -> approved / rejected message.
```

## Read-only Staff: Schedule

`<main>` H1 `Csoport naptár` → read-only schedule and event details. No edit controls, display-name visibility, email, or phone fields. Keyboard entry begins at Skip to content.

## Information Architecture and Style

Role-aware navigation: `Saját feladataim`, `Értesítések`, `Csoport naptár`, then admin-only `Irányítópult`, `Nyilvántartások`, `Feladatok és események`, `Jóváhagyások`, `Import`, `Archívum`, `Beállítások`. Use warm neutral surfaces, muted natural accent, generous spacing, low visual noise, shadcn/ui-compatible radius/type/color tokens, and Hungarian labels/errors. All screens target WCAG 2.2 AA: semantic landmarks, keyboard navigation, visible focus, labelled forms, screen-reader-readable Hungarian errors, and ARIA only where semantic HTML is insufficient.

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-07-30T12:18:27Z
**Iteration:** 1

### Findings

| # | Severity | Location | Finding | Recommendation |
|---|---|---|---|---|
| 1 | Critical | Entire `wireframes.md` | The artifact contains only textual component sequences; it provides no actual rough/ASCII screen layout for the parent dashboard, assignment detail, coordination dashboard, records, tasks/events, assignments/approvals, archive, import preview, or settings. A developer cannot determine mobile content order, grouping, control placement, or table/card behaviour from the prose alone. | Add low-fidelity ASCII wireframes for each listed screen at the mobile-first breakpoint, with an explicit desktop adaptation only where it materially differs. Show hierarchy, navigation, primary/secondary actions, and the relevant data fields. |
| 2 | Major | `Parent: Saját feladataim`; `Assignment Detail` | The prose names available/full, confirmation/error, and swap/cancellation outcomes, but does not show the zero-assignment state, loading treatment, or the form fields and actions for a cancellation reason and swap acceptance/decline. These states are required to make the parent self-service flow implementable and testable. | Add annotated state wireframes showing the empty, loading, available, full, swap-no-counterpart, swap decision, cancellation-reason, pending, approved, rejected, and error states. |
| 3 | Major | `Admin: Coordination`; `Read-only Staff: Schedule` | The screen inventory is not a usable layout specification for the committed admin and staff workflows: it omits the data/actions shown on each screen and has no permission-denied or empty-state presentation. In particular, it is unclear how group-scoped data is identified and how read-only staff see schedule/event detail without parent information. | Add screen-level wireframes and annotations for each admin/staff route, including role-scoped context, empty/error/permission states, displayed fields, and unavailable actions. |

### Summary

The navigation and high-level flows align with the MVP boundary, but this is not yet a rough-mockup handoff. Concrete screen layouts and the missing operational states are required before engineering can implement without guessing.
