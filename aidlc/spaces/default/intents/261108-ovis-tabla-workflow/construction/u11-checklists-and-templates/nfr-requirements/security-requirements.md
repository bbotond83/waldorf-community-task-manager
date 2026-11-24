# Security Requirements: u11-checklists-and-templates

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1, NFR3, NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C8, C9, C13 to C16 in `contract-summary.md`, and `technology-stack.md`. Contains no names or contact details.

## Authentication

Sign-in, sessions and password rules do not change. A signed-out visitor receives no template, checklist, claim or done-mark data and is sent to sign-in. The only new service-role entry points are the two daily checks, reached through U5's `timed_checks_run_system`, and the starting-template install function.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.10 | Every new read and write checks the caller on the database side, as its rule says (BR160 to BR170). | Database tests acting as real roles and accounts pass for each rule. |
| NFR3.11 | Saving, removing and restoring a template is refused for a parent who manages nothing, for a teacher, and for a coordinator acting on a community template or another group's template, including by calling the function directly (BR160.1, BR161.1). A refused template read is a denied refusal, never an empty list (BR161.2). | The fixed-list "out of reach" test passes for each template function. |
| NFR3.12 | Copying a template and changing an event's checklist are refused for anyone who is not a manager of the event, including a parent marked as organiser; a coordinator may not copy another group's template (BR163.2, BR164.1). | A test calls each command as each role and as an organiser-only parent. |
| NFR3.13 | An organisers' section and its tasks are left out of `checklist_get` for every caller outside the event's organising team; claiming or marking such a task by id answers the same as a task that does not exist (BR165.1, BR167.1). The session and role checks come before any row is looked up, so a caller refused by role (a teacher, a caller with no family) gets one answer whatever id it sends. | A test reads the checklist as a plain parent and a teacher and finds no organisers' section, and compares, for a plain parent and for a teacher, the refusal for a real organisers' task with one for a made-up id: the whole result envelope (state, reference and code) is the same, both write the same denied-audit entry, and neither leaves a row locked or changed. |
| NFR3.14 | Only the parent who made a claim can change it or give it up; the organising team can remove any claim; a parent of another family gets the same denied refusal for a real claim and a made-up one (BR165.3, BR165.4). | A test compares the two refusals: the same result envelope, the same denied-audit entry, and no row locked or changed in either case. |
| NFR3.15 | A teacher reads every parents' and teachers' section and is refused on every checklist and template command (BR167.1, BR165.1). | Reach tests for a teacher on every new read (allowed) and every command (refused). |
| NFR3.16 | The internal functions (`checklist_add_task`, `checklist_claimant_ids`, the removal pair, the two daily checks and `checklist_starting_templates_install`) cannot be executed by any signed-in role. Like the internal functions of earlier units, they run with the owner's rights and are called only from inside other functions of the same owner: `checklist_add_task` from U12's `todo_pull_to_event`, `checklist_claimant_ids` from U10's `event_save_core`, and the removal pair from U14's lifecycle functions, so no signed-in role needs an execute grant on them. The two daily checks are revoked from every role, the service role included, and run only through U5's `timed_checks_run_system`, as U9's check does; the install is granted to the service role only. | The catalogue test lists their grants (no role for the checks, service role only for the install), a direct call to a check as any role is refused, and a direct call to another internal function as a signed-in account is refused while the calling command, run as that account, succeeds. |
| NFR3.17 | Signed-in accounts keep read-only table rights and read no new table directly. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. | The catalogue test lists each new function's grants and each new table's rights. |
| NFR3.18 | A right lost while signed in applies at the next request: a coordinator whose grant is revoked is refused on the next template or checklist change, and a parent whose organiser role is removed no longer sees the organisers' section on the next read (BR170.2). | A test changes the right between two requests. |
| NFR3.19 | `verification/authorization-matrix.json` gains rows for the template, checklist, claim and done-mark commands and reads, for every role including an organiser-only parent, and each new or changed screen is walked through for every role. | Evidence is in the Unit's test results before merge. |
| NFR3.20 | No save can create a new link from a duty to an event, also by calling `task_save` directly; editing an already-linked task with its unchanged event, and removing the link, still work (BR169.1). | Tests save a new task with an event id and give an unlinked task an event (both refused), and edit a task linked before the change with its event unchanged and with the link removed (both allowed). |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.5 | The starting templates, seed, fixtures and tests use no real person's name or contact detail; the install content comes from the review appendices with names already removed. Any address or phone number in a test is on the privacy allowlist. | Secret scanning and the privacy check stay green; a test lists the installed templates' texts and finds no name from the privacy list. |
| NFR1.6 | The checklist read returns display names only (C6): no contact detail, no child's name, no sharing choice. A typed helper name is shown as typed with no link or profile (BR165.5). | A test asserts the exact fields `checklist_get` returns. |
| NFR1.7 | Template texts, task fields, claim notes and typed names are plain text, shown escaped, with their length limits enforced in the database (BR160.2, BR165.3, BR165.5). | A test saves markup in each and reads it back unchanged and escaped on the page. |
| NFR10.2 | The lead-time notice and the unclaimed-task alert name the event, its dates and place only, through U10's facts function; they never name a helper, a free task, a note or a contact detail (BR168.1, BR168.2). | A test reads each kind's text from the local test mailbox. |
| NFR10.3 | U10's cancellation and change notice, now also sent to checklist helpers (BR170.6), keeps its U10 text: it names the event, its dates and place, and never a task title, a claim note, a typed name, another helper or any contact detail. | A test cancels and moves an event with helpers and reads each helper's notice and email from the local test mailbox. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.9 | Removing and restoring a template, removing another person's claim, undoing another person's done mark and applying a removal each write one audit entry with opaque ids and the actor, and no name, note or task title; the change rolls back when the entry cannot be written (BR170.3). | A test reads the audit after each command and forces a failed write. |
| NFR4.10 | A repeated click writes no second audit entry. | The "repeated click" test counts entries. |
| NFR4.11 | Denied attempts are audited as they are today, under the existing rate limit. | The existing denied-audit tests pass. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent reads the organiser's list by calling the read or a task id directly | The read leaves it out and a direct call answers as not found (NFR3.13) |
| A coordinator edits a community or another group's template | Owner reach is checked in the function (NFR3.11) |
| A parent takes more places than a task has, or takes one twice | The task row is locked and claims counted inside the function (BR165.2) |
| A parent gives up or edits another family's claim | The claimant is checked inside the function (NFR3.14) |
| A note, tip or typed name injects markup | Plain text, escaped on output (NFR1.7) |
| A notice leaks who has or has not taken tasks | Texts come from the event's facts function only (NFR10.2) |
| A user triggers the daily checks or the template install | Service role only, never granted to a signed-in role (NFR3.16) |
| A function running with raised rights is steered to another schema | Every function pins its own schema (NFR3.17) |
