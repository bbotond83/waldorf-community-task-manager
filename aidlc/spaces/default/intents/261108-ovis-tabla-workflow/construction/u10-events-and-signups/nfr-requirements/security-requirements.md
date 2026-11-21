# Security Requirements: u10-events-and-signups

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C8, C13, C14 and C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no event, sign-up or offer data and is sent to sign-in. No new service-role entry point is added.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side, as its rule says (BR100 to BR119). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Creating, changing and cancelling an event, saving notices, the tale and roles, and removing a sign-up or offer are refused for a parent who is not a manager of that event, for a teacher, and for a manager of another group, including by calling the function directly. A refused read is a denied refusal, never an empty list. | The fixed-list "out of reach" test passes for each function. |
| NFR3.3 | Only the parent who made a sign-up or offer can change it; a parent of another family gets the same denied refusal for a real row and a made-up one, and the owner of an already withdrawn row gets not found (BR110.1). | A test compares the first two refusals and reads the third. |
| NFR3.4 | A teacher reads every event, as every signed-in reader does (BR104.1), and every command that creates or changes an event, role, notice, sign-up or offer is refused with the denied code (BR104.3). | Reach tests for a teacher on every new read (allowed) and every command (refused). |
| NFR3.5 | `event_role_clear_name` is refused for everyone except a super admin. | A test calls it as each role. |
| NFR3.6 | The internal functions (`event_is_summer`, `event_deadline`, `event_organisers`) and the removal pair cannot be executed by any signed-in role. | The catalogue test lists their grants, and a call as a signed-in account is refused. |
| NFR3.7 | Signed-in accounts keep read-only table rights. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.8 | A right lost while signed in applies at the next request: a coordinator whose grant is revoked, or a removed parent, is refused on the next event change. | A test revokes between two requests. |
| NFR3.9 | `verification/authorization-matrix.json` gains rows for the event commands, the sign-up and offer commands and the role clear, for every role, and each changed screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The event page returns display names only: no contact detail, no child's name, no sharing choice. A typed name on a role is shown as typed and carries no link or profile (BR105.2). | A test asserts the exact fields each read returns. |
| NFR1.3 | The three allergen ticks describe a dish only. No table, column, read or screen joins an offer, tick or notice to a child, a family's health or a diet (BR115.1). | A catalogue test lists the columns of the new tables; a screen test finds no such link. |
| NFR1.4 | A sign-up note and a food text are plain text, shown escaped, with their length limits enforced in the database (500 and 200 characters). | A test saves markup and reads it back unchanged and escaped on the page. |
| NFR10.1 | Every notice and email of this Unit names the event, its dates and place, and nothing else: no sign-up, offer, note, phone number, email address or child's name (NFR10, BR117.3). | A test reads each kind's text from the local test mailbox. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Cancelling an event, marking or unmarking an organiser role, a manager's removal of a sign-up or offer, clearing a typed name and applying a removal each write one audit entry with opaque ids and the actor, and no name, note or dish text; the change rolls back when the entry cannot be written (BR123.1). | A test reads the event after each command. |
| NFR4.2 | A repeated click writes no second event. | The "repeated click" test counts events. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent changes or withdraws another family's sign-up or offer by calling the function directly | The caller is checked inside the function (NFR3.3) |
| A parent edits another group's event | Manager reach is checked in the function (NFR3.2) |
| A note or dish text injects markup | Plain text, escaped on output (NFR1.4) |
| A notice leaks a note or contact detail | Texts come from the event's facts function only (NFR10.1) |
| An allergen tick is read as a child's health data | No link exists to children or families (NFR1.3) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.7) |
