# Security Design: u12-todo-and-my-tasks

How the requirements in `security-requirements.md` are met. Every check is on the database side; the TypeScript layers present and translate.

## Authorization

| Requirement | Design |
|---|---|
| NFR3.21, NFR3.28, NFR3.29 | Each new function starts with `revoke all` and an explicit `grant execute` to the roles that may call it, pins its search path and takes no table write right. The daily check, the removal pair, `checklist_task_done_state` and `notice_facts_todo` are granted to no signed-in role; `migration_load_todo` to the service role only. The catalogue test lists each grant. |
| NFR3.22, NFR3.26, NFR3.27 | Every command starts with the C2 caller decision (active session, role), then the reach decision for the owner: group tasks by the group's administrators and super admins, family tasks by super admins only, pulls by managers of the event's group. Teachers read only. A denied read answers with the denied refusal, never an empty list; `my_tasks_get` answers a teacher, a super admin without a family and any caller without a family with the denied refusal. Ids from another community answer as not found (NFR3.32). |
| NFR3.23 | The role and session checks come before any task lookup; a family-owned task claimed by another family and a made-up id both answer with the same envelope and denied-audit entry, differing only in the target id the audit stores as opaque. |
| NFR3.24 | Status, note, give-back and done mark check the claimant inside the function; free-claim and edits check the owner's administrators. |
| NFR3.25 | Claim, give-back and done mark re-read the caller's active-parent and active-family standing after the task row is locked, and for administrators the grant. U14's removal holds the family row but the to-do commands take no family lock (project rule), so a removal can commit between the first check and the task lock; the re-check after the lock is the guard that closes that gap. |
| NFR3.30 | No role is cached; every request re-reads grants. |
| NFR3.31 | `authorization-matrix.json` gets rows for every new command, read and screen. |

## Data protection

| Requirement | Design |
|---|---|
| NFR1.8 | Fixtures and the invented workbook hold made-up task text; any address or phone in a test goes on the privacy allowlist. |
| NFR1.9, NFR10.5 | Reads and `notice_facts_todo` return named fields only (C6 display names, topic, path); an exact field-list test per read. |
| NFR1.10 | Topic, description, materials and note are plain text with length checks in the table; the app escapes on output and never renders markup. |
| NFR10.4 | Notice text is built from the facts function only: topic and page, no person, owner family or contact detail. |

## Audit

| Requirement | Design |
|---|---|
| NFR4.17 | Freeing another person's claim, undoing another person's done mark, pulling, removal apply and migration load each write one audit row with opaque ids in the same transaction; a failed write rolls the change back. |
| NFR4.18, NFR4.19 | The idempotency key returns the stored result before any audit write; denied attempts use the existing rate-limited denied audit. |

## Threats

The threat table in `security-requirements.md` maps one-to-one onto the controls above.
