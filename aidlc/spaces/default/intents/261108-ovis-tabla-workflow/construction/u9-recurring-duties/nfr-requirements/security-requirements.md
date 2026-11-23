# Security Requirements: u9-recurring-duties

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C7, C8, C9, C12, C14 and C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no schedule or occurrence data and is sent to sign-in. No new service-role entry point is added; the daily check runs only through U5's existing service-role entry point.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every new read and write checks the caller on the database side, as its rule says (BR141 to BR151). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.2 | Saving, switching on or off and skipping are refused for a parent, for a teacher, for a coordinator of another group, and for a coordinator on a family-owned or rota-week-owned schedule, including by calling the function directly. A refused read is a denied refusal, never an empty list. | The fixed-list "out of reach" test passes for each function. |
| NFR3.3 | Marking done is refused for a parent of another family, a person outside the group, a teacher, and a super admin who is none of the owner people (BR145.1). The refusal is the same for a real occurrence and a made-up id. | A test compares the two refusals for each role. |
| NFR3.4 | Undo is allowed only for the person who marked, a coordinator of the group, or a super admin, and only within 24 hours (BR145.3). | Reach and time tests on both sides of the 24-hour mark. |
| NFR3.5 | A teacher reads group duties, as every signed-in reader does (BR150.1), and every command is refused with the denied code. Family-owned and rota-week-owned occurrences are read only by the owning family's parents and super admins. | Reach tests for a teacher and for a parent of another family on every read. |
| NFR3.6 | The internal functions (`recurring_due_check`, `recurring_notice_facts` and the removal pair) cannot be executed by any signed-in role. | The catalogue test lists their grants, and a call as a signed-in account is refused. |
| NFR3.7 | Signed-in accounts keep read-only table rights. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.8 | A right lost while signed in applies at the next request: a coordinator whose grant is revoked, a member who left the group, or a removed parent, is refused on the next command. | A test revokes between two requests. |
| NFR3.9 | The family that is responsible for a rota-week occurrence is read at the moment of the command, so a family that lost its water week cannot mark the cleaning done afterwards (BR147.2). | A test swaps the week between two requests and calls mark-done as the old and the new family. |
| NFR3.10 | `verification/authorization-matrix.json` gains rows for the schedule commands, mark done, undo and skip, for every role, and each changed screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families, people and duty titles only; any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.2 | Reads return display names only (through C6): no contact detail, no child's name, no sharing choice. A removed parent shows "korábbi tag" (BR151.1). | A test asserts the exact fields each read returns. |
| NFR1.3 | A title, a category and a skip reason are plain text, shown escaped, with their length limits enforced in the database (200, 100 and 200 characters). | A test saves markup and reads it back unchanged and escaped on the page. |
| NFR10.1 | Every notice and email of this Unit names the duty title and the due date, and nothing else: no other family, no person who marked it, no phone number or email address (BR149.2). | A test reads each kind's text from the local test mailbox. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | Saving or switching a schedule, marking done, undoing and skipping each write one audit entry with opaque ids and the actor, and no title, name or reason text; the change rolls back when the entry cannot be written (BR152.1). | A test reads the audit after each command. |
| NFR4.2 | A repeated click writes no second entry. | The "repeated click" test counts entries. |
| NFR4.3 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent marks another family's or group's duty done by calling the function directly | The caller is checked inside the function (NFR3.3) |
| A family that gave up the water week still marks the cleaning done | The responsible family is read live at the command (NFR3.9) |
| A coordinator edits another group's schedule | Manager reach is checked in the function (NFR3.2) |
| A title or reason injects markup | Plain text, escaped on output (NFR1.3) |
| A notice leaks who marked a duty or a contact detail | Texts come from the notice facts function only (NFR10.1) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.7) |
