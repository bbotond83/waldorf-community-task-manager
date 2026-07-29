# PRD — Ovi Community Task Manager Web Application

**Product / Feature Name:** Ovi Community Task Manager  
**Document Type:** Product Requirements Document  
**Version:** v1.0  
**Status:** AI-DLC-ready draft  
**Primary Product Language:** Hungarian UI  
**Implementation Language:** English codebase  
**Primary Platform:** Responsive web application  
**Recommended Stack:** Next.js + TypeScript + Tailwind CSS + shadcn/ui or shadcnuikit Pro + Supabase Postgres/Auth + Vercel + email provider such as Resend  
**Source Inputs:** Prior spreadsheet analysis, product owner interview decisions, existing manual Excel-based kindergarten community coordination workflow  

---

## 1. Executive Summary

The Ovi Community Task Manager is a responsive web application intended to replace the current Excel-based coordination workflow used by a kindergarten parent community.

Today, community tasks, parent contact data, cleaning schedules, weekend animal-care assignments, water-carrying duties, large cleaning events, workgroups, events, library tasks, water testing, and similar recurring responsibilities are managed in spreadsheets. This approach is flexible but difficult to maintain, error-prone, hard to scale, and weak from a privacy and notification perspective.

The new application will provide structured user management, family and child records, school-year-based organization, task and event scheduling, parent signups, admin assignments, swap and cancellation workflows, in-app notifications, email notifications, and one-time Excel import.

The product must support both administrators and parents. Administrators need to replace spreadsheet coordination with a reliable operating tool. Parents need a simple, mobile-friendly experience that answers the most important question: **What do I need to do, and when?**

The application code, database schema, tests, technical documentation, and developer-facing naming must be in English. The end-user interface must be in Hungarian.

---

## 2. Product Vision

Create a modern, privacy-aware, role-based web application that helps a kindergarten parent community coordinate responsibilities transparently and efficiently.

The application should become the single source of truth for:

- parents and families,
- children and kindergarten groups,
- school years,
- community tasks,
- event-related assignments,
- parent signups,
- admin assignments,
- swaps and cancellations,
- reminders and notifications,
- initial data migration from Excel.

The product should not simply reproduce the existing spreadsheet as a web table. It should convert the spreadsheet workflow into a structured task, event, and notification system.

---

## 3. Language and Localization Requirements

### 3.1 Code and Technical Language

All implementation artifacts must use English.

This includes:

- source code,
- variable names,
- function names,
- class names,
- type names,
- database table names,
- database column names,
- API routes,
- API payloads,
- test names,
- technical documentation,
- commit messages,
- AI-DLC technical artifacts unless explicitly requested otherwise.

Examples of expected English technical naming:

```ts
Parent
Child
Family
SchoolYear
KindergartenGroup
Task
TaskAssignment
Event
SwapRequest
CancellationRequest
Notification
EmailNotification
ImportBatch
```

Do not use Hungarian identifiers in code, such as:

```ts
Szulo
Gyerek
Csalad
Feladat
Beosztas
Ertesites
```

### 3.2 User Interface Language

The user-facing UI must be Hungarian.

This includes:

- navigation labels,
- button labels,
- form labels,
- empty states,
- validation messages,
- confirmation dialogs,
- notification text,
- email subject lines and email body text,
- role names shown in the UI,
- dashboard headings,
- task and event status labels.

Examples:

| Technical concept | Code / DB naming | Hungarian UI label |
|---|---|---|
| Parent | `Parent` / `parent` | Szülő |
| Child | `Child` / `child` | Gyerek |
| Family | `Family` / `family` | Család |
| School year | `SchoolYear` / `school_year` | Tanév |
| Kindergarten group | `KindergartenGroup` / `kindergarten_group` | Csoport |
| Task | `Task` / `task` | Feladat |
| Assignment | `TaskAssignment` / `task_assignment` | Beosztás / Vállalás |
| Signup | `Signup` or assignment source `self_signup` | Jelentkezés |
| Swap request | `SwapRequest` / `swap_request` | Cserekérés |
| Cancellation request | `CancellationRequest` / `cancellation_request` | Lemondási kérelem |
| Notification | `Notification` / `notification` | Értesítés |
| Upcoming tasks | `upcomingTasks` | Közelgő feladataid |

### 3.3 Translation Strategy

The implementation should be prepared for localization, even if Hungarian is the only MVP UI language.

Requirements:

- UI strings should not be hardcoded deep inside business logic.
- Hungarian copy should be centralized where practical.
- Email templates should use Hungarian text.
- Tests may assert translation keys or Hungarian copy depending on implementation strategy.
- The UI must be reviewed for consistent Hungarian terminology before release.

Recommended MVP approach:

- Use English technical keys.
- Use Hungarian display values.
- Keep a simple translation file or typed copy object, for example:

```ts
const hu = {
  navigation: {
    dashboard: "Kezdőlap",
    myTasks: "Saját feladataim",
    openTasks: "Nyitott feladatok",
    events: "Események",
    notifications: "Értesítések",
  },
};
```

---

## 4. Problem Statement

### 4.1 Current State

The kindergarten parent community currently coordinates shared responsibilities through spreadsheets.

The spreadsheet contains or previously contained areas such as:

- parent contact information,
- family and child information,
- indoor and outdoor cleaning schedules,
- weekend animal-care assignments,
- water-carrying tasks,
- large cleaning events,
- workgroups,
- community events,
- library-related duties,
- water testing,
- other recurring and ad hoc parent responsibilities.

The spreadsheet is flexible, but it does not provide structured workflows, permission control, notifications, or a parent-focused task view.

### 4.2 Core Problems

1. **Fragmented information**
   - Tasks, people, events, and responsibilities are distributed across spreadsheet tabs or sections.
   - Parents cannot quickly answer: "What are my upcoming responsibilities?"

2. **Manual coordination**
   - Admins or organizing parents must manually maintain assignments, open slots, changes, cancellations, and swaps.

3. **No built-in reminders**
   - Parents do not automatically receive reliable reminders about current or upcoming duties.

4. **Privacy limitations**
   - Contact details in spreadsheets are hard to protect.
   - The product owner decision is that parent contact details must be visible only to admins.

5. **Weak permission model**
   - Spreadsheet sharing cannot provide precise role-based access control.

6. **No structured swap or cancellation workflow**
   - When a parent cannot complete an assignment, the process requires manual communication.

7. **No clean school-year archive**
   - Yearly continuity and historical lookup are difficult.

---

## 5. Goals

### 5.1 Product Goals

- Replace the Excel-based coordination workflow with a structured web application.
- Support both administrators and parents as first-class MVP users.
- Provide role-based user management.
- Support school-year-based organization and archiving.
- Support parent, child, family, and group management.
- Support task and event creation.
- Support parent self-signup and admin assignment.
- Support swap and cancellation workflows.
- Provide in-app and email notifications.
- Show parents their current and upcoming tasks when they log in.
- Protect parent contact details from non-admin users.
- Support a one-time Excel import for initial migration.

### 5.2 Community Outcomes

- Reduce administrative overhead.
- Reduce forgotten duties.
- Improve transparency around shared responsibilities.
- Make participation easier for parents.
- Improve trust through better privacy controls.
- Preserve continuity across school years.

---

## 6. Success Metrics

### 6.1 Adoption Metrics

- At least 80% of active families log in during the first active month.
- At least 70% of active families view the "Saját feladataim" page during the first active month.
- At least 90% of new task signups happen inside the application instead of Excel or ad hoc messaging.

### 6.2 Operational Metrics

- Admin coordination time decreases by at least 40% compared to the spreadsheet workflow.
- The number of unfilled near-term task slots decreases.
- At least 80% of swaps and cancellations are processed through the application.

### 6.3 Notification Metrics

- 95% of parents with upcoming duties see an in-app upcoming-task notice on login.
- Parents assigned to upcoming duties receive email reminders according to the configured reminder schedule.
- Failed email deliveries are visible to admins.

### 6.4 Privacy Metrics

- Parent email addresses and phone numbers are not visible to normal parent users.
- Read-only teacher/staff users do not see parent contact details by default.
- No known role-based access control violations in production.

---

## 7. Confirmed Product Decisions

| Topic | Decision |
|---|---|
| Primary goal | Replace the current Excel-based kindergarten community coordination workflow with a web application |
| MVP primary users | Parents and admins are both important |
| Required roles | Super Admin, Kindergarten Admin, Group Admin / Organizing Parent, Parent, Read-only Teacher / Staff |
| MVP scope | Include all proposed MVP areas |
| Login-time upcoming task notice | Required |
| Notification channels | Email + in-app notifications |
| Assignment model | Mixed: admin assignment + parent self-signup |
| Completion tracking | Not required in MVP |
| Swap and cancellation | Required in MVP |
| Excel import | One-time initial migration |
| Parent contact visibility | Admin-only |
| School-year archive | Required in MVP |
| Technical stack | Next.js, TypeScript, Tailwind, shadcn/shadcnuikit, Supabase, Vercel, email provider |
| Code language | English |
| UI language | Hungarian |

---

## 8. Personas

### 8.1 Parent

A parent needs a simple way to see their own responsibilities, sign up for open tasks, and request changes when they cannot complete a duty.

Key needs:

- Log in easily.
- See upcoming personal tasks immediately.
- View open tasks.
- Sign up for tasks.
- Request a swap.
- Request cancellation.
- Receive clear Hungarian notifications.
- Avoid seeing other parents' private contact details.

### 8.2 Group Admin / Organizing Parent

A group admin or organizing parent coordinates a limited scope, such as a kindergarten group, event, or task category.

Key needs:

- Create and manage tasks within their scope.
- Assign parents to tasks.
- See unfilled slots.
- Review swaps and cancellations.
- Notify affected parents.
- Avoid full system-level complexity.

### 8.3 Kindergarten Admin

A kindergarten admin manages the full operational structure.

Key needs:

- Manage school years.
- Manage groups.
- Manage users and roles.
- Manage families and children.
- Manage task categories, tasks, and events.
- Run initial Excel import.
- Monitor notifications and workflow issues.
- Access parent contact details when needed.

### 8.4 Super Admin

A super admin manages system-level settings and highest-level permissions.

Key needs:

- Configure the organization.
- Assign admin roles.
- View system-level audit activity.
- Support data correction and migration.
- Control high-impact settings.

### 8.5 Read-only Teacher / Staff

A teacher or staff member may need visibility into schedules and events without managing data.

Key needs:

- View relevant events.
- View relevant task schedules.
- Avoid editing data.
- Avoid seeing parent contact details unless explicitly approved in a later requirement.

---

## 9. Roles and Permissions

### 9.1 Required MVP Roles

- `super_admin`
- `kindergarten_admin`
- `group_admin`
- `parent`
- `read_only_staff`

### 9.2 Permission Matrix

| Capability | Super Admin | Kindergarten Admin | Group Admin / Organizer | Parent | Read-only Staff |
|---|---:|---:|---:|---:|---:|
| Manage organization settings | Yes | Limited | No | No | No |
| Create / archive school year | Yes | Yes | No | No | No |
| Manage groups | Yes | Yes | Limited to own scope | No | No |
| Invite users | Yes | Yes | Limited if enabled | No | No |
| Manage roles | Yes | Yes | No, except limited delegated scope if approved | No | No |
| View parent contact details | Yes | Yes | Yes only within admin scope | No | No |
| Edit parent contact details | Yes | Yes | Limited if approved | Own profile only, limited | No |
| Manage families and children | Yes | Yes | Own group scope | Own family limited | Read-only without contact data |
| Create tasks | Yes | Yes | Own scope | No | No |
| Edit tasks | Yes | Yes | Own scope | No | No |
| Assign parents to tasks | Yes | Yes | Own scope | No | No |
| Sign up for open tasks | Yes | Yes | Yes | Yes | No |
| Request swap | Yes | Yes | Yes | Own assignment only | No |
| Request cancellation | Yes | Yes | Yes | Own assignment only | No |
| Approve swap | Yes | Yes | Own scope | No | No |
| Approve cancellation | Yes | Yes | Own scope | No | No |
| View admin dashboard | Yes | Yes | Own scope | No | Optional read-only subset |
| View audit log | Yes | Yes | Limited own scope | No | No |
| Run Excel import | Yes | Yes | No | No | No |

### 9.3 Contact Visibility Rule

Parent contact details are admin-only.

Normal parent users must not see:

- other parents' email addresses,
- other parents' phone numbers,
- exportable contact lists,
- hidden contact metadata.

This must be enforced at the database/API authorization layer, not only in the frontend.

---

## 10. MVP Scope

### 10.1 In Scope

The MVP includes:

1. User authentication and invitation-based onboarding.
2. Role-based access control.
3. School-year management and archiving.
4. Kindergarten group management.
5. Parent, family, and child management.
6. Admin-only parent contact data.
7. Task categories.
8. Task creation and scheduling.
9. Multi-slot tasks.
10. Event creation.
11. Event-related tasks.
12. Parent self-signup.
13. Admin assignment.
14. Swap workflow.
15. Cancellation workflow.
16. Parent dashboard.
17. Admin dashboard.
18. In-app notification center.
19. Email notifications.
20. Login-time upcoming-task notice.
21. One-time Excel import with preview and validation.
22. Audit logging for important admin and workflow actions.
23. Responsive mobile-first UI.
24. Hungarian end-user interface.
25. English codebase and technical artifacts.

### 10.2 Out of Scope

The MVP does not include:

- Native iOS app.
- Native Android app.
- Mobile push notifications.
- SMS.
- WhatsApp or Messenger integration.
- Payment management.
- Automatic fair rotation.
- Completion tracking.
- Parent self-confirmation of task completion.
- Admin confirmation of task completion.
- Recurring Excel synchronization.
- Public parent contact directory.
- Community chat.
- Complex forum features.
- AI-based automatic scheduling.
- Two-way external calendar synchronization.
- Multi-kindergarten SaaS operations beyond minimal future-proofing.
- Full document management.

---

## 11. Product Principles

1. **Mobile-first**
   - Parent workflows must work well on a phone.

2. **My tasks first**
   - A parent should immediately understand what they need to do next.

3. **Privacy by default**
   - Contact data is admin-only.

4. **Structured workflows, not a web spreadsheet**
   - The app should model tasks, events, assignments, swaps, and cancellations.

5. **Admin efficiency**
   - Admin workflows should be faster and clearer than spreadsheet coordination.

6. **Hungarian UX**
   - The UI must feel natural for Hungarian-speaking parents and staff.

7. **English implementation**
   - The technical system must remain maintainable for developers through English naming and documentation.

---

## 12. Current Spreadsheet-to-Product Mapping

| Existing spreadsheet area | Product module | Notes |
|---|---|---|
| Parent contact details | Users, families, admin-only contact fields | Parents cannot see other parents' contact data |
| Children / families | Family and child model | A family may have multiple children and multiple parents |
| Indoor / outdoor cleaning | Task category + scheduled task slots | Signup or admin assignment |
| Weekend animal care | Recurring or scheduled task slots | May span a weekend |
| Water carrying | Recurring task category | No automatic rotation in MVP |
| Large cleaning | Event + multi-slot tasks | Multiple participants |
| Workgroups | Task area / category / organizer scope | Start simple |
| Events | Event module | Events can have related tasks |
| Library duties | Task category or event-related task | Exact workflow should be validated |
| Water testing | Recurring task category | Reminder behavior important |
| Other community work | Generic task category | Should be configurable |

---

## 13. Functional Requirements

### 13.1 Authentication and User Management

#### FR-001 — Invitation-based registration

Admins can invite users by email.

Acceptance criteria:

- Admin can enter an email address and role.
- The system sends a Hungarian invitation email.
- Invitation has an expiration time.
- Expired invitation can be resent.
- User can complete account setup through the invitation link.

#### FR-002 — Login

Users can log in securely.

Acceptance criteria:

- User can log in with email/password or supported Supabase Auth method.
- Inactive users cannot log in.
- Password reset is supported.
- Login errors are shown in Hungarian.

#### FR-003 — Role assignments

The system supports role assignments with scope.

Examples:

- User A is a parent in Group 1.
- User A is also an organizing parent for cleaning tasks.
- User B is a kindergarten admin for the full organization.

Acceptance criteria:

- Roles can be assigned by authorized admins.
- Role changes are audited.
- UI access changes according to role.

---

### 13.2 Family, Parent, and Child Management

#### FR-010 — Family model

The system must support family records.

Acceptance criteria:

- A family can have multiple parents.
- A family can have multiple children.
- A family belongs to an organization and school year context.

#### FR-011 — Child profile

The system must store minimal child information.

MVP fields:

- first name,
- last name,
- kindergarten group,
- school year,
- status.

Acceptance criteria:

- Admin can create and edit child records.
- Parents can see their own child records.
- Other parents cannot browse private child/family data beyond what is necessary for task coordination.

#### FR-012 — Parent contact details

Parent email and phone details are admin-only.

Acceptance criteria:

- Parent cannot see other parents' email addresses.
- Parent cannot see other parents' phone numbers.
- Read-only staff cannot see parent contact details by default.
- Admin can view and edit contact details.
- Contact changes are audited.

#### FR-013 — Parent self-profile

Parents can view and update limited own profile data.

Acceptance criteria:

- Parent can view own name and contact details.
- Parent may update own phone number if enabled.
- Email change may require admin approval or auth-provider flow.
- Validation messages are Hungarian.

---

### 13.3 School Year and Group Management

#### FR-020 — School year management

The system must support school-year-based operation.

Acceptance criteria:

- Admin can create a school year.
- One school year can be marked active.
- A school year can be archived.
- Archived school-year records are read-only by default.
- Users can view historical data if authorized.

#### FR-021 — Group management

Admins can manage kindergarten groups.

Acceptance criteria:

- Group name is unique within a school year.
- Children and families can be assigned to groups.
- Group admins can be assigned to a group.

---

### 13.4 Task Management

#### FR-030 — Task categories

Admins can manage task categories.

Initial categories should include:

- cleaning,
- weekend animal care,
- water carrying,
- large cleaning,
- event support,
- library,
- water testing,
- workgroup,
- other.

Hungarian UI labels should be used, for example:

- Takarítás
- Állatos hétvége
- Vízhordás
- Nagytakarítás
- Rendezvény
- Könyvtár
- Vízvizsgálat
- Munkacsoport
- Egyéb

#### FR-031 — Task creation

Admins and authorized group admins can create tasks.

Fields:

- title,
- description,
- category,
- school year,
- kindergarten group,
- event link optional,
- location,
- start date/time,
- end date/time optional,
- signup deadline optional,
- capacity,
- visibility,
- responsible admin or organizer.

Acceptance criteria:

- Required fields are validated.
- Hungarian validation messages are displayed.
- Created task appears in relevant parent views if open and visible.

#### FR-032 — Multi-slot tasks

Tasks can require multiple participants.

Acceptance criteria:

- Task capacity can be greater than one.
- Parents can sign up until capacity is full.
- Admin can override capacity only with explicit confirmation.
- Full tasks are clearly labeled in Hungarian.

#### FR-033 — Admin assignment

Admins can assign a parent to a task manually.

Acceptance criteria:

- Assigned parent receives in-app and email notification.
- Assignment appears in the parent's "Saját feladataim" view.
- Assignment action is audited.

#### FR-034 — Parent self-signup

Parents can sign up for open visible tasks.

Acceptance criteria:

- Parent can only sign up for visible eligible tasks.
- Duplicate signup for the same task is prevented unless explicitly allowed.
- Successful signup creates an assignment.
- Parent receives confirmation notification.

#### FR-035 — Task editing

Admins and authorized organizers can edit tasks.

Acceptance criteria:

- Changes to date, time, location, cancellation, or important content notify assigned parents.
- Significant changes are audited.
- UI displays confirmation for changes affecting existing assignments.

#### FR-036 — Task cancellation

Tasks can be cancelled.

Acceptance criteria:

- Cancelled tasks remain in history.
- Assigned parents receive notification.
- Cancelled tasks no longer appear as active upcoming duties.
- Hard delete is restricted to high-permission admins or not supported in MVP.

#### FR-037 — No completion tracking in MVP

The MVP must not implement task completion tracking.

Acceptance criteria:

- No "completed", "done", or "missed" workflow is required.
- No parent completion confirmation.
- No admin completion confirmation.
- The system manages assignments, swaps, and cancellations only.

---

### 13.5 Event Management

#### FR-040 — Event creation

Admins can create events.

Fields:

- title,
- description,
- date,
- start/end time,
- location,
- linked groups,
- visibility,
- status.

Acceptance criteria:

- Events are shown to relevant parents.
- Events can have linked tasks.
- Event UI is in Hungarian.

#### FR-041 — Event-related tasks

Events can contain multiple tasks.

Examples:

- bring supplies,
- cleaning,
- setup,
- teardown,
- decoration,
- food contribution,
- helper role.

Acceptance criteria:

- Parent can sign up for event-related tasks.
- Admin can see open event slots.
- Event details show task status.

---

### 13.6 Swap Workflow

#### FR-050 — Parent starts swap request

A parent can request a swap for their own assignment.

Acceptance criteria:

- Parent can select "Cserét kérek" from assignment detail.
- Parent can enter optional reason.
- Request is visible to admin or organizer.
- Parent receives confirmation.

#### FR-051 — Swap review

Admin or authorized organizer can approve or reject swap requests.

Acceptance criteria:

- Reviewer can approve or reject.
- A replacement parent can be selected if applicable.
- A swap decision sends notifications to affected users.
- Decision is audited.

#### FR-052 — Parent-to-parent takeover

The system may allow another parent to take over an assignment.

Acceptance criteria:

- Replacement parent receives confirmation.
- Original parent no longer sees the assignment as active after approved swap.
- Both affected parents receive notifications.

---

### 13.7 Cancellation Workflow

#### FR-060 — Parent starts cancellation request

A parent can request cancellation for their own assignment.

Acceptance criteria:

- Parent can select "Lemondást kérek".
- Parent can enter optional reason.
- Admin / organizer receives notification.
- Request appears in admin dashboard.

#### FR-061 — Cancellation review

Admin or organizer can approve or reject cancellation.

Acceptance criteria:

- If approved, assignment is removed or marked inactive according to implementation design.
- Slot becomes open again if appropriate.
- If rejected, assignment remains active.
- Parent receives notification.
- Decision is audited.

#### FR-062 — Urgent cancellation

Near-term cancellations should be highlighted.

Recommended MVP rule:

- If the task starts within 48 hours, the cancellation request is marked urgent.

---

### 13.8 Notifications

#### FR-070 — In-app notification center

The application must provide in-app notifications.

Acceptance criteria:

- User can view notifications.
- User can mark notifications as read.
- Notification links to the relevant task, event, swap, or cancellation.
- Notification text is Hungarian.

#### FR-071 — Login-time upcoming task notice

When a parent logs in, the dashboard must show current or upcoming duties.

Acceptance criteria:

- Dashboard displays "Közelgő feladataid".
- Default upcoming window is 7 days.
- If there are no upcoming tasks, a clear Hungarian empty state appears.
- Parent can open the related task detail.

#### FR-072 — Email notifications

The system must send Hungarian email notifications for key events.

MVP email triggers:

- invitation,
- new assignment,
- successful signup,
- task change,
- task cancellation,
- upcoming task reminder,
- swap request,
- swap approved/rejected,
- cancellation request,
- cancellation approved/rejected.

#### FR-073 — Email and in-app channels

Important workflow events must create both email and in-app notifications.

Acceptance criteria:

- In-app notification is created even if email delivery fails.
- Email delivery failures are visible to admins.
- Email content is Hungarian.

#### FR-074 — Notification noise control

The system should avoid unnecessary notification spam.

Recommended MVP rules:

- Avoid duplicate reminders for the same trigger.
- Avoid sending multiple emails for rapid minor edits unless important fields changed.
- Admin should be able to preview mass-impacting notifications when practical.

---

### 13.9 Parent Dashboard

#### FR-080 — Parent home dashboard

Parents see a personalized dashboard after login.

Required sections:

- upcoming tasks,
- active swap/cancellation statuses,
- open signup opportunities,
- upcoming events,
- unread notifications.

Acceptance criteria:

- Parent can reach own upcoming duties immediately.
- Parent cannot see admin-only contact information.
- UI is optimized for mobile.

#### FR-081 — My tasks

Parents can view their own assignments.

Filters:

- upcoming,
- current,
- past,
- swap requested,
- cancellation requested.

Hungarian UI label:

- "Saját feladataim"

#### FR-082 — Open tasks

Parents can browse tasks they are eligible to sign up for.

Filters:

- date,
- group,
- category,
- event.

Hungarian UI label:

- "Nyitott feladatok"

---

### 13.10 Admin Dashboard

#### FR-090 — Admin overview

Admins see an operational dashboard.

Required sections:

- upcoming tasks,
- unfilled slots,
- pending swap requests,
- pending cancellation requests,
- failed email notifications,
- import issues,
- filters by school year and group.

#### FR-091 — Unfilled slot management

Admins can quickly identify and handle unfilled task slots.

Acceptance criteria:

- Filter by date, group, and category.
- Admin can assign a parent directly.
- Admin can send a reminder to eligible parents if supported.

#### FR-092 — Audit log

Important actions are audited.

Events to audit:

- user creation,
- role change,
- contact data changes,
- task creation/edit/cancellation,
- event creation/edit/cancellation,
- parent signup,
- admin assignment,
- swap request and decision,
- cancellation request and decision,
- import commit.

---

### 13.11 Excel Import

#### FR-100 — One-time Excel import

The system supports one-time initial migration from the existing spreadsheet.

Acceptance criteria:

- Admin can upload Excel file.
- System parses recognized sheets/sections.
- System displays preview.
- System displays validation issues.
- Admin can approve import commit.
- Import creates structured records.

#### FR-101 — Import validation

Import must validate common issues.

Examples:

- missing email,
- duplicate parent,
- duplicate child,
- unknown group,
- invalid date,
- ambiguous task category,
- empty assignment slot,
- missing school year.

#### FR-102 — Import audit

Import batch must be audited.

Fields:

- uploaded by,
- timestamp,
- filename,
- created records,
- updated records,
- skipped rows,
- errors and warnings.

---

## 14. Notification Matrix

| Trigger | Recipient | In-app | Email | Hungarian UI / copy requirement |
|---|---|---:|---:|---|
| Invitation | Invited user | No | Yes | Hungarian invitation email |
| Admin assigns parent | Assigned parent | Yes | Yes | Must link to task |
| Parent signs up | Parent | Yes | Yes | Confirmation |
| Parent signs up | Admin / organizer | Yes | Optional | Configurable later |
| Task date/time/location changes | Assigned parents | Yes | Yes | Important change |
| Task cancelled | Assigned parents | Yes | Yes | Critical |
| Upcoming task 7 days before | Assigned parent | Yes | Yes | Reminder |
| Upcoming task 24 hours before | Assigned parent | Yes | Yes | Optional but recommended |
| Parent starts swap request | Admin / organizer | Yes | Yes | Workflow item |
| Swap approved | Affected parents | Yes | Yes | Decision notice |
| Swap rejected | Requesting parent | Yes | Yes | Decision notice |
| Parent starts cancellation request | Admin / organizer | Yes | Yes | Workflow item |
| Cancellation approved | Requesting parent | Yes | Yes | Decision notice |
| Cancellation rejected | Requesting parent | Yes | Yes | Decision notice |
| Upcoming unfilled slot | Admin / organizer | Yes | Optional | Dashboard also required |
| Parent login | Parent | Yes, dashboard block | No | "Közelgő feladataid" |

---

## 15. Conceptual Data Model

### 15.1 Core Entities

#### Organization

Represents the kindergarten or community.

Fields:

- id
- name
- slug
- created_at
- updated_at

#### SchoolYear

Represents a school year.

Fields:

- id
- organization_id
- name
- start_date
- end_date
- status: draft / active / archived

#### KindergartenGroup

Represents a kindergarten group.

Fields:

- id
- organization_id
- school_year_id
- name
- description
- status

#### User

Represents a login-capable person.

Fields:

- id
- auth_user_id
- display_name
- email
- phone
- status
- created_at
- updated_at

#### RoleAssignment

Represents a role in a scope.

Fields:

- id
- user_id
- role
- organization_id
- school_year_id nullable
- kindergarten_group_id nullable
- task_area_id nullable

#### Family

Represents a family unit.

Fields:

- id
- organization_id
- display_name
- status
- created_at
- updated_at

#### Child

Represents a child.

Fields:

- id
- family_id
- kindergarten_group_id
- school_year_id
- first_name
- last_name
- status

#### ParentFamilyLink

Links parent users to families.

Fields:

- id
- user_id
- family_id
- relationship_type

---

### 15.2 Task Entities

#### TaskCategory

Fields:

- id
- organization_id
- name_key
- display_name_hu
- description
- active

#### Task

Fields:

- id
- organization_id
- school_year_id
- kindergarten_group_id nullable
- event_id nullable
- category_id
- title
- description
- location
- starts_at
- ends_at
- signup_deadline
- capacity
- status: draft / open / full / cancelled / archived
- created_by
- responsible_user_id nullable

#### TaskAssignment

Fields:

- id
- task_id
- user_id
- assigned_by nullable
- assignment_source: self_signup / admin_assigned / swap
- status: active / swap_requested / cancellation_requested / removed
- created_at
- updated_at

#### SwapRequest

Fields:

- id
- task_assignment_id
- requested_by
- replacement_user_id nullable
- reason nullable
- status: pending / approved / rejected / cancelled
- reviewed_by nullable
- reviewed_at nullable

#### CancellationRequest

Fields:

- id
- task_assignment_id
- requested_by
- reason nullable
- urgent boolean
- status: pending / approved / rejected / cancelled
- reviewed_by nullable
- reviewed_at nullable

---

### 15.3 Event Entities

#### Event

Fields:

- id
- organization_id
- school_year_id
- kindergarten_group_id nullable
- title
- description
- location
- starts_at
- ends_at
- visibility
- status

---

### 15.4 Notification Entities

#### Notification

In-app notification.

Fields:

- id
- user_id
- type
- title_hu
- body_hu
- related_entity_type
- related_entity_id
- read_at nullable
- created_at

#### EmailNotification

Email delivery log.

Fields:

- id
- user_id
- email
- template_key
- subject_hu
- status: queued / sent / failed
- provider_message_id nullable
- error_message nullable
- created_at
- sent_at nullable

---

### 15.5 Import Entities

#### ImportBatch

Fields:

- id
- organization_id
- school_year_id
- uploaded_by
- filename
- status: uploaded / validated / committed / failed
- created_at
- committed_at nullable

#### ImportIssue

Fields:

- id
- import_batch_id
- severity: error / warning
- sheet_name
- row_number
- column_name
- message

---

## 16. Key User Journeys

### 16.1 Parent logs in and sees upcoming tasks

1. Parent logs in.
2. Parent dashboard opens.
3. "Közelgő feladataid" section appears.
4. The system lists duties in the next 7 days.
5. Parent opens task details.
6. Parent may request swap or cancellation.

Acceptance criteria:

- Parent reaches upcoming duties with no more than one click from dashboard.
- Empty state is clear and Hungarian.
- No admin-only contact data is exposed.

### 16.2 Parent signs up for an open task

1. Parent opens "Nyitott feladatok".
2. Parent filters by group, category, date, or event.
3. Parent opens task details.
4. Parent signs up.
5. System confirms signup.
6. In-app and email confirmation are created.
7. Task appears under "Saját feladataim".

### 16.3 Admin creates event with tasks

1. Admin creates event.
2. Admin adds related task slots.
3. Admin publishes event.
4. Parents see event and related open tasks.
5. Parents sign up.
6. Admin dashboard shows filled and unfilled slots.

### 16.4 Parent requests swap

1. Parent opens own assignment.
2. Parent clicks "Cserét kérek".
3. Parent optionally enters reason.
4. Admin / organizer receives notification.
5. Admin approves or rejects.
6. Affected users receive notifications.

### 16.5 Parent requests cancellation

1. Parent opens own assignment.
2. Parent clicks "Lemondást kérek".
3. Parent optionally enters reason.
4. Admin / organizer receives notification.
5. Admin approves or rejects.
6. If approved, slot opens again or becomes admin-attention-needed.

### 16.6 Admin imports Excel file

1. Admin uploads Excel file.
2. System parses file.
3. Preview appears.
4. Validation issues appear.
5. Admin resolves or accepts warnings.
6. Admin commits import.
7. Import audit record is created.

---

## 17. UX Requirements

### 17.1 Parent Navigation

Hungarian navigation labels:

- Kezdőlap
- Saját feladataim
- Nyitott feladatok
- Események
- Értesítések
- Profil

### 17.2 Admin Navigation

Hungarian navigation labels:

- Dashboard
- Feladatok
- Események
- Csoportok
- Családok
- Szülők
- Gyerekek
- Cserék és lemondások
- Import
- Értesítések
- Beállítások
- Audit

### 17.3 Parent Dashboard Requirements

Must show:

- next upcoming task,
- task date,
- task category,
- location,
- event link if applicable,
- "Cserét kérek" action,
- "Lemondást kérek" action,
- unread notifications,
- open signup opportunities.

### 17.4 Admin Dashboard Requirements

Must show:

- upcoming unfilled slots,
- pending swaps,
- pending cancellations,
- failed email deliveries,
- upcoming events,
- import issues,
- quick action buttons.

### 17.5 Mobile Requirements

- Main parent workflows must work at 375px viewport width.
- Lists should become card-based on mobile.
- Important action buttons must be easy to tap.
- Admin tables may use responsive layouts or simplified mobile views.

---

## 18. Privacy and Security Requirements

### 18.1 Privacy by Default

- Parent contact details are admin-only.
- Normal parents cannot see other parents' email or phone.
- Read-only staff cannot see contact details by default.

### 18.2 Sensitive Data

Sensitive data includes:

- parent names,
- parent emails,
- parent phone numbers,
- child names,
- family links,
- assignments,
- swap reasons,
- cancellation reasons.

### 18.3 Access Control

- Authorization must be enforced server-side and/or database-side.
- Supabase Row Level Security is expected.
- Frontend hiding is not sufficient.
- Role and scope must be considered for every sensitive query.

### 18.4 Audit

Audit should cover:

- role changes,
- contact data changes,
- imports,
- task changes,
- admin assignments,
- swap decisions,
- cancellation decisions.

### 18.5 Data Retention

- School years can be archived.
- Archived data is read-only by default.
- Deletion/anonymization rules require later privacy decision.
- MVP should support soft-delete or archival patterns where appropriate.

---

## 19. Non-Functional Requirements

### 19.1 Performance

Targets:

- Parent dashboard loads in under 2 seconds for normal data volume.
- Admin task list filters respond in under 2 seconds for normal data volume.
- Import preview may take longer but should show progress or clear feedback.

### 19.2 Reliability

- Important notifications should not silently disappear.
- In-app notification should be created even if email fails.
- Failed emails must be visible to admins.

### 19.3 Usability

- Parent workflows must be understandable for non-technical users.
- Hungarian copy must be clear and consistent.
- Common actions should require minimal clicks.

### 19.4 Accessibility

- Follow basic WCAG AA guidance.
- Support keyboard navigation for main flows.
- Use sufficient contrast.
- Show form errors clearly.

### 19.5 Maintainability

- Use modular domain structure.
- Keep business logic testable.
- Avoid Hungarian technical identifiers.
- Avoid hardcoded UI copy scattered across business logic.

### 19.6 Observability

MVP should provide:

- audit log,
- email delivery status,
- import issue logs,
- application error logging.

---

## 20. MVP Release Criteria

The MVP is releasable when:

1. Admin can create and manage school years.
2. Admin can create and manage groups.
3. Admin can invite users.
4. Role-based permissions work.
5. Parent contact details are admin-only.
6. Admin can manage families and children.
7. Admin can create tasks.
8. Admin can create events.
9. Parent can sign up for open tasks.
10. Admin can assign parent to task.
11. Parent can see own current and upcoming tasks.
12. Login-time upcoming task section works.
13. Email notifications work for core events.
14. In-app notifications work for core events.
15. Parent can request swap.
16. Parent can request cancellation.
17. Admin can approve/reject swap and cancellation.
18. Admin dashboard shows unfilled slots and pending workflow items.
19. One-time Excel import supports preview and validation.
20. School-year archive exists.
21. Mobile parent workflow is usable.
22. Critical access-control tests pass.
23. UI is Hungarian.
24. Codebase and technical naming are English.

---

## 21. Suggested Milestones

### Milestone 1 — Foundation

- Project setup.
- Auth.
- Role model.
- Layout.
- Localization structure.
- School year and group basics.

### Milestone 2 — People and Families

- Users.
- Families.
- Children.
- Parent-family links.
- Admin-only contact visibility.
- Invitations.

### Milestone 3 — Tasks and Events

- Task categories.
- Task CRUD.
- Event CRUD.
- Slots.
- Parent signup.
- Parent dashboard.

### Milestone 4 — Workflow

- Admin assignment.
- Swap requests.
- Cancellation requests.
- Admin workflow dashboard.

### Milestone 5 — Notifications

- In-app notification center.
- Email notifications.
- Upcoming task reminders.
- Login-time upcoming task block.

### Milestone 6 — Excel Import

- Upload.
- Parsing.
- Preview.
- Validation.
- Commit.
- Import audit.

### Milestone 7 — Hardening

- Permission tests.
- Privacy review.
- Mobile UX polish.
- Accessibility review.
- Release readiness.

---

## 22. Risks and Mitigations

### Risk 1 — Scope Creep

The spreadsheet may contain many special cases.

Mitigation:

- Model most needs as configurable tasks, categories, events, and slots.
- Defer automation and special-purpose workflows.

### Risk 2 — Privacy Mistakes

Parent contact information is sensitive.

Mitigation:

- Use database-level authorization.
- Test parent and staff access thoroughly.
- Keep contact details admin-only.

### Risk 3 — Import Complexity

The spreadsheet may be inconsistent.

Mitigation:

- Treat import as admin-assisted.
- Provide preview and validation.
- Do not promise perfect automated migration.

### Risk 4 — Notification Fatigue

Too many emails may cause parents to ignore notifications.

Mitigation:

- Limit reminders.
- Avoid duplicate notifications.
- Use in-app notifications for lower-priority updates.

### Risk 5 — Role Complexity

Multiple roles and scopes can create bugs.

Mitigation:

- Keep permission matrix explicit.
- Add authorization tests.
- Avoid over-delegation in MVP.

---

## 23. Open Questions

These should be resolved during AI-DLC Intent Capture and Requirements Analysis.

1. Can parents see other parents' display names in task assignments, while contact details remain hidden?
2. Can read-only staff see parent names attached to task assignments?
3. Should reminders be sent 7 days before, 24 hours before, or both?
4. Should every cancellation require admin approval?
5. Can a swap be auto-approved when another parent takes over, or must admin approve?
6. Can assignments belong to a family instead of a specific parent?
7. If a family has multiple parents, can either parent handle the assignment?
8. What are the final task categories?
9. Do weekend animal care, water carrying, and water testing require special fields?
10. Is iCal export needed in MVP or later?
11. Should admins be able to send manual group reminders?
12. What should be the email sender name and email address?
13. Should event attachments be supported?
14. How exactly should school-year rollover work?
15. What remains editable after a school year is archived?
16. What data must be deleted or anonymized when a family leaves?
17. What exact Excel format is officially supported for import?
18. Who is the final product owner for swap, cancellation, and privacy decisions?

---

## 24. AI-DLC Instructions

### 24.1 Intent

Build a responsive web application that replaces the current Excel-based kindergarten parent community coordination workflow with role-based user management, family and child records, school-year-based organization, tasks, events, signups, swaps, cancellations, in-app notifications, email notifications, admin dashboards, and one-time Excel migration.

### 24.2 Authoritative Source

Use this PRD as the authoritative source:

```text
source-materials/ovi-community-app/ovi-community-task-manager-prd-v1-en.md
```

### 24.3 Language Rules

- Generate source code in English.
- Generate database schema in English.
- Generate tests in English.
- Generate technical documentation in English unless explicitly requested otherwise.
- The user-facing UI must be Hungarian.
- Email copy must be Hungarian.
- In-app notification copy must be Hungarian.
- Do not use Hungarian variable, class, function, table, or API names.
- Preserve Hungarian UI terminology consistently.

### 24.4 Scope Rules

During Intent Capture and Requirements Analysis:

- Preserve privacy requirement: parent contact details are admin-only.
- Preserve all required roles.
- Preserve MVP scope: users, families, children, groups, school years, tasks, events, signups, swaps, cancellations, notifications, archive, and one-time import.
- Do not add native mobile, SMS, WhatsApp, payments, automatic rotation, completion tracking, or recurring Excel sync unless explicitly approved.
- Ask clarification questions for unresolved requirements.
- Do not begin implementation until Requirements Analysis and Application Design have been reviewed.

### 24.5 Technical Emphasis

Pay special attention to:

- role-based authorization,
- Supabase Row Level Security,
- contact-data privacy,
- notification behavior,
- import validation,
- mobile-first parent UX,
- Hungarian UI copy,
- English technical naming.

---

## 25. Definition of Done

A feature slice is done when:

- It satisfies the relevant functional requirements.
- It has role-based access tests.
- It does not expose admin-only contact details to parent or read-only roles.
- It has happy-path and failure-path tests where appropriate.
- It handles empty states.
- It works on mobile viewport for parent workflows.
- It creates audit records where required.
- User-facing copy is Hungarian.
- Technical naming is English.
- It has clear error messages.
- It does not include unapproved assumptions.
- It is documented well enough for the next AI-DLC stage.

---

## 26. Initial AI-DLC Starter Prompt

```text
Build the Ovi Community Task Manager web application.

The authoritative PRD is:
source-materials/ovi-community-app/ovi-community-task-manager-prd-v1-en.md

Product goal:
Replace the current Excel-based kindergarten parent community coordination workflow with a role-based web application for parents, families, children, school years, groups, tasks, events, signups, swaps, cancellations, email notifications, in-app notifications, admin dashboards, and one-time Excel migration.

Important language rules:
- All code, database schema, tests, and technical documentation must use English naming.
- The end-user UI must be Hungarian.
- Email and in-app notification copy must be Hungarian.
- Do not use Hungarian identifiers in code.

Important product rules:
- Parent contact details are admin-only.
- Required roles: Super Admin, Kindergarten Admin, Group Admin / Organizing Parent, Parent, Read-only Teacher / Staff.
- MVP includes task/event management, parent self-signup, admin assignment, swap/cancellation workflow, notifications, school-year archive, and one-time Excel import.
- MVP excludes native mobile apps, SMS, WhatsApp, payments, automatic rotation, completion tracking, and recurring Excel sync.

During Intent Capture and Requirements Analysis:
- Read the PRD carefully.
- Identify unresolved requirements.
- Ask clarification questions before implementation.
- Pay special attention to authorization, Row Level Security, notification behavior, Hungarian UI copy, and Excel import validation.
- Do not start implementation until Requirements Analysis and Application Design have been reviewed and approved.
```
