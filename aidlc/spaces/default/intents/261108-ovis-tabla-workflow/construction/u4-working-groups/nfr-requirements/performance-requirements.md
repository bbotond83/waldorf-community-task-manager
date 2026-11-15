# Performance Requirements: u4-working-groups

Sources: NFR8 and NFR9 in `requirements.md`, plus `functional-spec.md` and `rules.md` of this Unit, and `technology-stack.md`. There are two pages to measure: the working-group list, which already exists, and the new group page with its member list.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.8 | The group page and the group admin page each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set of 30 invented families, with every parent a member of one group. |
| NFR9.9 | The group detail function returns the group, its coordinator status and the whole member list in one call. Each phone and email decision is made in the database (BR42.2). The call stays under 2 seconds on the `db:seed:large` set of 30 invented families. | A database test times the call as a parent, a teacher and a super admin. |
| NFR9.10 | Join, leave, appoint and revoke each finish in under 2 seconds, including the notice and its queued email. | A database test times each command on the large seed. |
| NFR9.11 | The changes to `directory_list` (the shared contact helpers) and to `lifecycle_run_core` do not slow the directory or the family-lifecycle run. | The existing timing tests pass on the large seed. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.3 | All text on the new screens is Hungarian, including the refusal texts, the confirmation shown before leaving, the no-coordinator notice and the two coordinator notice titles. | Checked in the screenshots and the notice texts. |
| NFR8.4 | The group page and the group admin page are designed in Stitch first. They work at phone width and by keyboard, wrap long names, and have no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
