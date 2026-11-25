# Security Requirements: u12-todo-and-my-tasks

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C8, C9 and C14 to C17 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no to-do, history, claim or My tasks data and is sent to sign-in. The new service-role entry points are the daily deadline check (through U5's `timed_checks_run_system`) and `migration_load_todo`.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.21 | Every new read and write checks the caller on the database side, as its rule says (BR180 to BR190). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.22 | Adding, changing, freeing a claim on and updating a task is refused for a parent who manages nothing, for a teacher, and for a coordinator acting on another group's task or on a family-owned task, including by calling the function directly (BR180.2). A refused read is a denied refusal, never an empty list (BR180.1). | The fixed-list "out of reach" test passes for each function. |
| NFR3.23 | A family-owned task can be claimed only by a parent of that family; any other parent gets the same denied refusal as for a task that does not exist for them to claim (BR182.1). The role and session checks come before the task is read, and only the family-ownership check looks at the row. | A test compares the refusals for a real family-owned task and a made-up id: same result envelope and same denied-audit entry apart from the opaque target id, and nothing changed. |
| NFR3.24 | Only the claimant and the owner's administrators change a claimed task's status or note or mark it done; only the claimant gives it back, and the administrators free the claim (BR182.3); a parent of the claimant's family and a teacher are refused (BR183.1, BR183.2). | A test calls each command as each role. |
| NFR3.25 | A claim, a give-back and a done mark re-check, after the task row is locked, that the caller is still an active parent with an active family (and, for the owner's administrators, still holds the grant). A removal that commits between the first check and the lock leaves no claim for the removed person. | A two-at-once test runs U14's removal block against a claim and finds either a refused claim or a cleared and flagged one, never a live claim for a removed parent. |
| NFR3.26 | Pulling tasks into an event is refused for anyone who does not manage the event's group, a coordinator of another group included, and for a closed event (BR185.1). | A test calls the command as each role. |
| NFR3.27 | A teacher reads the whole list and its history and is refused on every to-do command; My tasks answers a teacher and a super admin without a family with the denied refusal (BR180.1, BR186.1). | Reach tests for a teacher on every new read and command. |
| NFR3.32 | A task, event or checklist task from another community answers as not found, never as denied with detail (BR180.1, BR185.1). | A test calls each read and command with an id from a second community. |
| NFR3.28 | The internal functions (the daily check, the removal pair, `checklist_task_done_state`, `notice_facts_todo`) cannot be executed by any signed-in role; the daily check is revoked from every role and runs only through U5's run; `migration_load_todo` is granted to the service role only. | The catalogue test lists their grants, and a direct call as a signed-in account is refused. |
| NFR3.29 | Signed-in accounts keep read-only table rights and read no new table directly. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path and grants no table write right. | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.30 | A right lost while signed in applies at the next request: a coordinator whose grant ended is refused on the next task change or management page request (BR189.2). | A test changes the right between two requests. |
| NFR3.31 | `verification/authorization-matrix.json` gains rows for the new commands, reads and screens for every role, and each new or changed screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.8 | Seed data, fixtures and tests use no real person's name or contact detail. The invented workbook for `migration_load_todo` holds no real task text from the owner's workbook. Any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green. |
| NFR1.9 | The list and My tasks return display names only (C6): no contact detail, no child's name, no sharing choice. | A test asserts the exact fields `todo_get` and `my_tasks_get` return. |
| NFR1.10 | Topic, description, materials and note are plain text, shown escaped, with their length limits enforced in the database (BR181.1). | A test saves markup in each and reads it back unchanged and escaped on the page. |
| NFR10.4 | The change notice and the deadline reminder name the task's topic and its page only; they never name another person, the owner family or any contact detail (BR188.1, BR188.2). | A test reads each notice and email from the local test mailbox. |
| NFR10.5 | The notice facts function returns the topic and path only. | A test calls it and asserts the exact fields. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.17 | Freeing another person's claim, undoing another person's done mark, pulling tasks into an event, applying a removal and a migration load each write one audit entry with opaque ids and the actor and no name, topic or note; the change rolls back when the entry cannot be written (BR189.3). | A test reads the audit after each command and forces a failed write. |
| NFR4.18 | A repeated click writes no second audit entry. | The "repeated click" test counts entries. |
| NFR4.19 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent claims another family's task | The caller's family is checked in the function (NFR3.23) |
| A removed parent keeps a claim | Re-check after the lock, and removal clears and flags (NFR3.25, BR190.1) |
| A coordinator edits another group's or a family's task | Owner reach checked in the function (NFR3.22) |
| A parent edits or finishes another parent's claimed task | Claimant checked inside the function (NFR3.24) |
| A note or topic injects markup | Plain text, escaped on output (NFR1.10) |
| A notice leaks who holds a task | Text comes from the facts function only (NFR10.4) |
| A user triggers the deadline check or the load | Never granted to a signed-in role (NFR3.28) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.29) |
