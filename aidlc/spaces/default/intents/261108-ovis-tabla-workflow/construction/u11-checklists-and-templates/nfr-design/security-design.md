# Security Design: u11-checklists-and-templates

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and contracts C1, C2, C6, C8, C9 and C13 to C16 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Decision points.** Three internal helpers decide every right, so no command repeats its own check:

| Helper | Decides | Built on |
|---|---|---|
| `checklist_template_manager(template)` | super admin, or a coordinator of the template's group (BR160.1) | C2 `has_community_admin`, `can_manage_group` |
| `checklist_event_manager(event)` | a manager of the event (BR100.1), the same decision as U10's `event_lock_managed` | C2, U10's event row |
| `checklist_event_team(event)` | a manager, or a parent in `event_organisers(event)` (C13) | the two above |

**Reads.** `checklist_get` checks the session and `can_read_community` (C2) first; anyone else gets the denied result, never an empty list. It then computes `checklist_event_team` once and, when false, leaves every organisers' section and its tasks out of the query itself, not after it (NFR3.13). The template reads call `checklist_template_manager` or, for `template_list(group_id)` and `template_options`, `can_manage_group` (NFR3.11).

**Commands.** Template commands call the template helper; copy and checklist edits call the event-manager helper, so an organiser-only parent fails (NFR3.12); claim, give-up, typed helper, done and undo call the rule of BR165 and BR166 on the event team helper and the caller's own claim. A teacher fails every command, because a teacher has no parent record and no manager right (NFR3.15).

**Check order.** Every command checks the session, the community and the caller's role first (an active parent record with a family for claims and done marks, a manager right for edits), before it reads any row. A teacher or a caller without a family is therefore refused with the same answer for every id it sends, real or made up.

**Hidden and made-up ids look the same.** Only after those checks pass does a command that names a task or claim read the row's event without a lock. When the row does not exist, or it is an organisers' task and the caller is outside the team, or it is a claim of another family, the command answers `denied` with `CHECKLIST_TASK_UNAVAILABLE` (or the denied code for a claim) before taking any lock and writes the same denied-audit entry through the existing helper. No row is locked or changed on that path, so both cases leave the same trace (NFR3.13, NFR3.14).

**Internal functions.** `checklist_add_task`, `checklist_claimant_ids` and the removal pair are owned by the same database owner as every other function and run with the owner's rights; they hold no `execute` grant for any signed-in role and are reached only from inside `todo_pull_to_event` (U12), `event_save_core` (U10) and U14's lifecycle functions. The two daily checks are revoked from every role, the service role included, and are reached only through U5's `timed_checks_run_system`, which holds the system-caller guard and the run record, as U9's `recurring_due_check` is. `checklist_starting_templates_install` is granted to the service role only, for the seed and the later hosting setup (NFR3.16).

**Rights and grants.** Every function starts with `revoke all`, grants `execute` to the roles it needs, pins its search path and writes only through its own statements; the seven new tables have row-level security on and no policy for signed-in roles, so they are read only through the functions (NFR3.17). Rights are read at each call, so a revoked grant or a removed organiser role applies at the next request (NFR3.18). The authorization matrix gains the new rows, including an organiser-only parent as its own column (NFR3.19). `task_save_core` compares the sent `event_id` with the stored one: a new task with an event, or an existing task whose event would change from empty or to another event, is refused on the event field; the same event as stored, or an empty one, passes, so today's task screen, which re-sends the stored event id on every edit, keeps working with no change to `src/data/admin-tasks.ts` or its tests (NFR3.20, NFR11.4).

## Data Protection

| Requirement | Design |
|---|---|
| NFR1.5 | The install content is copied from the review appendices, where names were already removed; a test lists every installed text and checks it against the privacy list. Test data stays invented. |
| NFR1.6 | `checklist_get` builds people only from C6 (`parent_display_name`, `family_display_name`) and returns a typed name as text; a test asserts the exact field list. |
| NFR1.7 | All texts are stored as plain text with database length checks and are never rendered as markup, so React escapes them. |
| NFR10.2 | Both new kinds use U10's `notice_facts_event`, which returns title, dates and place only. |
| NFR10.3 | `event_save_core` only adds recipients; the kind and its facts function stay U10's, so a helper gets exactly the text every other recipient gets. |

## Audit

Each audited action of BR170.3 writes one entry in the same transaction through the existing audit helper, with the action name, the actor and opaque ids (NFR4.9). The idempotency record makes a repeated click return the stored result and write nothing more (NFR4.10). Denied attempts use the existing denied audit and rate limit (NFR4.11).

## Threat Handling

| Threat | Design |
|---|---|
| Reading the organiser's list directly | Filtered inside the read query; direct calls answer as not found with no lock (NFR3.13) |
| Editing another group's or a community template | One template-manager helper in every template command (NFR3.11) |
| Over-filling a task | Task row locked, then claims counted, plus a deferred database check (scalability design) |
| Changing another family's claim | Lookup scoped to the caller's own parent record (NFR3.14) |
| Markup in a note, tip or typed name | Plain text, escaped on output (NFR1.7) |
| A notice leaks helpers or free tasks | Only U10's event facts function builds the text (NFR10.2, NFR10.3) |
| A user triggers the daily checks or the install | Service role only (NFR3.16) |
| A raised-rights function steered to another schema | Pinned search path on every function (NFR3.17) |
