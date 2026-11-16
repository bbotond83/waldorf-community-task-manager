# Logical Components: u4-working-groups

Where the designs in this folder apply. The requirements come from this Unit's NFR requirement files, the behaviour from `functional-spec.md`, and the boundaries from `contract-summary.md`.

## Components

Everything runs in one application and one database, with no service boundary.

| Component | Part in this Unit | If it fails |
|---|---|---|
| WorkingGroups | Membership `version` and `end_reason`, the page read, join, leave, appoint and revoke, `group_members`, `group_coordinators`, and the removal preview and apply (C16) | The page shows its error state, or a command rolls back |
| Identity | `grant_admin` (unchanged), `end_admin` with its reason, the BR41.7 refusal in the general role-change function | The coordinator change rolls back. A defect in the role-change function affects every role change, so it gets the full fixed test list. |
| Community (directory) | The two contact helpers, and `directory_list` moved onto them | A defect changes what the directory and the group page show. The comparison test catches it before merge. |
| Notifications | Two notice kinds and one target row with its facts function, all used through `notice_send` | The appoint or revoke rolls back. A failed email shows on U5's failures screen. |
| Lifecycle | `lifecycle_run_core` ends grants before deleting memberships | The family erasure rolls back. The lifecycle tests catch it before merge. |
| Audit | `role.grant` and `role.revoke` rows, with the reason in the detail | The change rolls back |
| WebApplication | Three group routes, the group page and the admin page, the message map, the navigation and the matrix rows | The page shows its error state |

## Blast Radius

U4 changes four functions that other Units own: `end_admin`, the general role-change function, `directory_list` and `lifecycle_run_core`. Each change is in U4's own migration and is covered by the existing tests of its owner plus U4's new cases. `directory_list` is the widest: a defect there changes every directory card, so the comparison test and U3's matrix tests run in the same pull request.

## Shared Resources

U4 uses one Postgres database, the audit log, U5's notice queue and the mail catcher.

Three contracts tie U4 to other Units:
- **C7 (`group_members`, `group_coordinators`):** U4 provides them for later Units.
- **C16 (removal):** U4's block is called by U14, which must call it before U3's directory block.
- **C8 (`notice_send`):** U4 uses it unchanged.
