# Security Requirements: u1-community-foundation

This Unit rewrites who may reach what, so it carries the main security risk of the work. Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3 and NFR4 in `requirements.md`, contracts C1, C2 and C6 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no working-group data and is sent to sign-in (BR2.4).

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every read and write this Unit changes or adds checks the caller on the database side (BR3.2 to BR3.10). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | A group administrator cannot reach another group's or a community-wide item as an administrator, including by calling the function or reading the table directly (BR3.4). | The fixed-list "out of reach" test passes for every admin command and admin read. |
| NFR3.3 | A refusal does not reveal whether the item exists (BR3.4). | A real id out of reach and a made-up id produce the same refusal. |
| NFR3.4 | A revoked right applies at the next request (BR3.11). | A test revokes a grant, or archives the linked parent or family, and the next request is denied. |
| NFR3.5 | A stale link never grants access (BR3.2). | A `group_admin` grant whose parent or family is not active manages nothing. |
| NFR3.6 | Signed-in accounts keep read-only table rights, and every new function starts with no rights and grants only what it needs (BR6.1). | The catalogue test lists each new function's grants and finds no table write right. |
| NFR3.7 | Every row of `verification/authorization-matrix.json` is tested for the new roles, and every screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | No real person's name or contact details enter the repository. The six working-group names and texts are not personal data. | Seed, fixtures and tests use invented people only; secret scanning stays green. |
| NFR1.2 | Family, parent, child and contact records are readable only by the family's own parents and super admins (BR3.9). | Database tests show a group administrator and a teacher are refused. |
| NFR1.3 | The family list for group administrators returns id and display name only (BR3.10). | A test asserts the exact returned fields. |
| NFR1.4 | Teachers keep display-name fields only on the schedule until U3 (BR3.7). | The teacher's sensitive-field matrix row stays denied. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Every role grant and revocation writes one audit event with opaque ids and no name or contact detail (BR3.12). | A test reads the event after each change. |
| NFR4.2 | Denied administrator attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A group administrator calls a function directly for another group | The database checks the item's group inside the function (NFR3.2) |
| An item with no group passes a comparison by accident | Empty is treated as a value and reached only by a super admin (`functional-spec.md`, Conversion of Existing Code) |
| A function running with raised rights is steered to another schema | Every function pins its own schema, as today |
| A pending invitation grants an outdated role | The change deletes all invitations, and the new pairs refuse `group_admin` (BR1.4, BR3.6) |
| The clean-start step runs against real data | Real data does not exist before the hosting work. A hosted database gets this change while empty, and `db:reset` refuses anything but the local stack |
