# Business Overview

## Purpose

The application replaces the spreadsheet a Hungarian Waldorf kindergarten parent community uses to share work. Families take turns at duties (cleaning, animal care, water carrying, event help), swap duties with each other, and receive reminders. Administrators maintain the family records and plan the work; teachers see who is on duty.

It is a personal project for one community: all user-facing text is Hungarian, all code and technical documents are English. The repository is public and holds only invented data. Nothing deploys automatically: the owner runs the app locally against a local backend.

The active intent (`261108-ovis-tabla-workflow`) is to match the whole app to the spreadsheet's real workflow so the spreadsheet can be retired. The owner-approved gap analysis is `aidlc/spaces/default/knowledge/documents/ovis-tabla-gap-analysis.md`.

## Domain Vocabulary

| Term in code | Hungarian on screen | Meaning |
|---|---|---|
| organization | | The whole community. Every table carries `organization_id`. |
| school_year | nevelési év | A named date range. Groups belong to one school year. |
| group | csoport | Today a kindergarten group (class). The owner decided these become the base for working groups. |
| family | család | The unit that holds duties. |
| parent | szülő | A person in a family; may be linked to one sign-in account. |
| child | gyermek | Listed under a family by name only. |
| group_membership | | A family's active or ended membership of a group. |
| event | esemény | A dated occasion with a place, a free-text coordinator name and three notes. |
| task, also "duty" in code | feladat | A dated piece of work with a capacity, optionally inside an event. |
| assignment | hely | One family's place on one task. |
| change_request | cserekérelem, lemondási kérelem | A request to swap or cancel a place. |
| contribution_note | saját megjegyzés | The family's own note on its place. |
| notification | értesítés | An in-app message for one parent. |
| reminder_job | emlékeztető | A planned, simulated reminder, 7 days and 24 hours before a task. |
| import run | import | One upload of the workbook through preview, conflicts and commit. |
| lifecycle | adat-életciklus | Deleting or anonymizing the data of a family that left. |

## Roles and What Each Can Do Today

Roles are `app_role_grants` rows scoped to one thing, enforced in the database and repeated in the application matrix (`src/access/role-policy.ts`, `src/application/authorization.ts`).

| Role | Scope | Can do | Cannot do |
|---|---|---|---|
| `parent` | one family | See tasks of the family's groups, sign up, write a note on the family's own place, request a swap or cancellation, answer swap requests, read own notifications | See other families' contacts, children, or who holds which task (only inside the swap partner list); edit own details |
| `kindergarten_teacher` | one group | Read the schedule of the group, including family names on each task | Change anything; see contacts, notes or reasons |
| `group_admin` | one group | Manage families reached through the group, tasks, events, places, approvals, archive of children and families | Import, reminders, data lifecycle, settings, roles; school years and groups themselves |
| `super_admin` | organization | Everything, including import, reminders, data lifecycle, settings and revoking roles | Revoke own grant; remove the last super admin |

## Key Business Processes

- **Family records**: an admin creates a family with parents (name, email, phone, locality, optional profile with consent), children and group memberships in one save.
- **Task planning**: an admin creates tasks and events one at a time. A task of an event shares its group.
- **Sign-up**: a parent takes a free place until the task starts; the family must be an active member of the task's group.
- **Swap**: a parent picks another family's place on another open, future task of the same group. The other family confirms (no admin needed) or declines. An admin can also decide.
- **Cancellation**: a parent asks; an admin decides. The place stays taken until then.
- **Notifications and reminders**: in-app notices are written in the same transaction as the change. Reminders are planned per task and "delivered" by simulation; no email is sent.
- **Workbook import**: a super admin uploads an `.xlsx` in a fixed 17-sheet template, resolves conflicts and commits once. Rows are matched against existing families and tasks.
- **Leaving families**: archiving frees future places. After 30 days a super admin can delete the family, or anonymize it when it has history.

## Business Rules That Shape New Work

- A family holds at most one live place per task; places taken never exceed capacity (1 to 50).
- A task that has started cannot be signed up for or swapped; a cancelled task removes its places for good.
- Swaps stay within one group; any task category can swap with any other.
- Every change is idempotent (a repeat of the same key returns the stored result) and most carry an expected version, so a stale screen is refused.
- Contact details are visible only to the same family and admins in reach. The optional profile is stored only with consent, and is visible only to its parent and admins in reach.
- Only role, approval, import and lifecycle actions are audited; ordinary record edits are not.

## Fit Against the Spreadsheet Workflow

Summary of what the code confirms for the gap analysis:

| Building block | State in code |
|---|---|
| Directory visible to parents, self-service profile, per-field profile, sharing consent | Missing. No parent page or read path. One free-text profile with one consent flag. |
| Sign-in email change | Blocked on purpose by a database trigger on `auth.users` (`20261022`). Needs a sanctioned path. |
| Year-long rotas, school calendar with breaks, bulk planning | Missing. `school_years` has only start and end dates; tasks are created one at a time. |
| Linked weekend duties, fair-share counts, unfilled-slot alerts | Missing. No link between tasks; reminders go only to families with places. |
| Done marks and recurrence | Missing. `assignments.status` has no completed state; no recurrence model. |
| Event checklists, templates, sign-up categories, roles on events | Missing. Events have free-text notes and coordinator only. |
| Community-wide events and tasks | Blocked by schema. `events.group_id` and `tasks.group_id` are required. |
| Working groups, working-group admin | Partly. Groups and `group_admin` exist; no description, no self-join, membership is per family. |
| To-do list, "My tasks", information page, lending library | Missing. |
| Real reminder delivery | Partly. Jobs, attempts and in-app notices exist; delivery is simulated and needs a list to be opened. |
| Spreadsheet migration | Partly. The import reads only the fixed template; the owner chose a one-off script instead. |
| Invitations from a screen | Partly. Library, email and acceptance page exist; no screen or command sends them. |

Reuse candidates are the family, parent and child records, memberships, sign-up, swap and cancellation kernel, notifications, idempotency, audit and row-level security patterns.
