# Logical Components: u1-community-foundation

Where the designs in `security-design.md` and the other files of this folder apply. Requirements come from `security-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`. Behaviour comes from `functional-spec.md`, and boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| Identity helpers | The one decision point, role and scope pairs, invitations | Every protected page is denied |
| WorkingGroups | Group and membership structure, list function | The list shows its error state |
| Community | Family reach becomes super admin only; display names | Records and names are unavailable to administrators |
| Duties (today's tasks) | Optional group; membership checks removed | Parents' task lists and sign-up show their error state |
| Notifications | Recipient rule and empty-group handling | Reminders are not planned; the task change still succeeds as today |
| Lifecycle | Membership removal by parent | Removal rolls back |
| WebApplication | Policy, matrix, navigation, list page, forms | The page shows its error state |
| Seed and reset | The six groups, new roles, no import data | The local stack is not rebuilt; no effect on the app's rules |

## Blast Radius

The decision point is shared by every admin rule, so a defect there affects the whole admin area. That is why it gets the full fixed test list and the matrix walk. The migration is all-or-nothing, so a failed run has no partial effect.

## Shared Resources

One Postgres database and the audit log. C2's functions are consumed by every later Unit, so their names and meanings are fixed here.
