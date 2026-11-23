# Security Design: u9-recurring-duties

Sources: `security-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` and `rules.md` of this Unit, and C1, C2, C6, C8, C9, C12 and C16 in `contract-summary.md`. No names or contact details appear here.

## Design Approach

Every check happens inside the named database function, so a direct call is as safe as a call from the screen. The TypeScript layers only translate and present. There are three kinds of function, and each has one fixed pattern.

| Kind | Functions | Pattern |
|---|---|---|
| Signed-in commands | `recurring_schedule_save`, `recurring_schedule_set_active`, `recurring_mark_done`, `recurring_undo_done`, `recurring_skip` | Active session check, then reach check, then idempotency lookup, then locks, then change, then audit, then C1 envelope |
| Signed-in reads | `recurring_list`, `recurring_my_occurrences`, `recurring_bottle_for_duty` | Reach check, then one JSON document; a refused reach is the denied refusal, never an empty list |
| Internal | `recurring_due_check`, `recurring_notice_facts`, `recurring_removal_preview`, `recurring_removal_apply` | `revoke all` and no grant to any signed-in role; the daily check is reached only through U5's service-role entry point |

All new functions start with `revoke all`, then an explicit `grant execute`, pin their search path to their own schema and are schema-neutral (NFR3.7). No signed-in role gets a table write right.

## Reach Decisions (NFR3.1 to NFR3.5)

| Command | Who may | Check inside the function |
|---|---|---|
| Save, switch on or off | Group-owned: coordinators of that group and super admins. Family-owned and rota-week-owned: super admins only | `can_manage_group(group_id)` for group-owned; super admin test otherwise (BR141.1) |
| Mark done | Group-owned: a member or coordinator of the group. Family-owned: a parent of that family. Rota-week-owned: a parent of the family that holds the week now | Reach helper per owner kind; the rota family is read with `rota_family_for` at the moment of the command (BR145.1, BR147.2) |
| Undo | The person who marked it, a coordinator of the group, or a super admin; only within 24 hours | Time compared in Budapest time inside the function (BR145.3) |
| Skip | Same reach as save | As save (BR146.1) |
| Read | Group-owned: every signed-in reader. Family-owned and rota-week-owned: parents of the owning family and super admins | Reach helper; denied refusal otherwise (BR150.1) |

**Decision D-SEC-1, super admin asymmetry (settles review finding R-04).** A super admin who is none of the owner people can read, undo and skip every occurrence but cannot mark one done. This is intended: a done mark says that a member of the owner did the work, so an outsider cannot make it. The authorization matrix and the database tests carry an explicit super-admin row for read, mark done, undo and skip on a group-owned, a family-owned and a rota-week-owned occurrence (NFR3.10).

**Same refusal for real and made-up ids (NFR3.3).** Mark done, undo and skip look up the occurrence and the caller's reach in one step and raise the same denied refusal when either fails, so a caller cannot tell a real id from a made-up one.

**Rights are read live (NFR3.8, NFR3.9).** Nothing about reach is copied onto the schedule or occurrence. Group membership, coordinator grants and the rota-week holder are read when the command runs, so a revoked grant or a swapped week applies on the next request.

## Data Protection (NFR1.1 to NFR1.3, NFR10.1)

- Reads return display names through C6 and nothing else about a person. A removed parent shows as "korábbi tag" (D-REL-3 in `reliability-design.md`).
- Titles, categories and skip reasons are stored as plain text with database length checks of 200, 100 and 200 characters, and the screens escape them on output. The app renders them as text nodes; no function builds markup.
- Notice and email texts come only from `recurring_notice_facts`, which returns the title and due date and nothing else (BR149.2, NFR10.1). It has no access to the done-by person, other families or contact data.
- Seed data, fixtures and tests use invented families and titles; any address or number in a test goes on the privacy allowlist (NFR1.1).

## Audit (NFR4.1 to NFR4.3)

Each of the five commands writes one audit row in the same transaction as the change, holding the actor and opaque ids only, never a title, name or reason text. If the audit write fails, the change rolls back. A repeated click returns the stored result before any write, so it adds no second row (NFR4.2). Denied attempts use the existing denied audit and its rate limit (NFR4.3).

## Threats and Controls

| Threat | Control | Requirement |
|---|---|---|
| A parent marks another family's duty done by calling the function directly | Reach checked inside the function; identical refusal for real and made-up ids | NFR3.3 |
| A family that gave up the water week marks the cleaning done | Responsible family read live, re-checked after the lock (see `scalability-design.md`) | NFR3.9 |
| A coordinator edits another group's schedule | `can_manage_group` inside the function | NFR3.2 |
| Title or reason injects markup | Plain text, escaped on output | NFR1.3 |
| A notice leaks who marked a duty or a contact detail | Texts only from `recurring_notice_facts` | NFR10.1 |
| A function with raised rights is steered to another schema | Pinned search path on every function | NFR3.7 |
| A signed-in account runs the daily check or the removal functions | `revoke all`, no grant; catalogue test lists the grants | NFR3.6 |

## Design Notes

- The design adds no new authentication, session or secret. The daily check keeps U5's service-role entry point and adds no key.
- `verification/authorization-matrix.json` gains the rows for every role and every command, and each changed screen is walked per role before merge (NFR3.10).
