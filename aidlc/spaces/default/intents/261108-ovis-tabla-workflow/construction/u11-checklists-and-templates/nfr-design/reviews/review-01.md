## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T14:41:35Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u11-checklists-and-templates/nfr-design/security-design.md > Authorization Architecture > Rights and grants (NFR3.20); reliability-design.md > Testing (NFR11.4) | The design says `task_save_core` refuses any non-empty `event_id` before any other check, and that the existing task tests run unchanged. Today's facade (`src/data/admin-tasks.ts`, `event_id: payloadText(payload, "eventId") ?? fromRow("event_id")`) re-sends the stored `event_id` on every edit, and `src/data/admin-port.test.ts` asserts it is sent. Editing a task that was linked to an event before this change would therefore be refused. That contradicts NFR11.4 (already-linked rows keep working; only a new link is refused). | State the exact rule: refuse an `event_id` only when it creates a new link, meaning a create, or an update where it differs from the stored value. An unchanged id on an already-linked task, and an explicit unlink, stay allowed. Add a database test that edits a legacy-linked task. Say whether the facade stops sending the id or the existing tests change in the same pull request. | New |
| R-02 | Minor | nfr-design/security-design.md > Authorization Architecture > Internal functions (NFR3.16) | The two daily checks are granted to the service role. The latest precedent (U9's `recurring_due_check`, `20261064_recurring_duties.sql`) revokes the check functions from every role, service role included. `timed_checks_run_system` reaches them as the owner through the registry, and it alone carries the system-caller guard and the run record. A direct service-role call to a check would skip both and could take an arbitrary moment. | Either follow U9 and grant the checks to nobody (then adjust the NFR3.16 wording and the catalogue test), or record why a direct service-role grant is wanted. | New |
| R-03 | Minor | nfr-design/reliability-design.md > Daily checks (NFR7.17) | `timed_checks_run_system` runs in a single transaction, and the per-event `begin ... exception` blocks are subtransactions. A killed run therefore rolls back every event and the run record, so the required test "abort a run after the first event" cannot leave the first event committed. The text implies that a partial commit is possible. | Reword the design to say a stopped run leaves nothing committed and the rerun sends everything once. Decide how the test simulates the stop, for example an error forced after the first event, which rolls back the check. | New |
| R-04 | Minor | nfr-design/security-design.md > Authorization Architecture > Hidden and made-up ids look the same | The design does not say whether the caller-right check (session, teacher, no parent record) comes before or after the unlocked row lookup. If the lookup comes first, a teacher or an outsider gets `CHECKLIST_TASK_UNAVAILABLE` for an invented id but `authorization_denied` for a real organisers' task id. That would reopen the existence oracle NFR3.13 and NFR3.14 close. | Fix the order: role and session refusal first, then the lookup. Make the NFR3.13 test run the real-versus-made-up comparison for a teacher as well as for a plain parent. | New |
| R-05 | Minor | nfr-design/scalability-design.md > Locking (NFR5.13) | The claim "no command locks a family row" holds for U11's own commands. `checklist_add_task` takes the event share lock and is called from U12's `todo_pull_to_event`, which under the team's lock order may already hold a family row. The design does not record that U12 must take the family row before the event row. | Add a line to the contract for `checklist_add_task`: callers lock the family first, and the event row never leads to a family lock. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Hand traceability check | 56 NFR ids in the six requirement files, 56 in `upstream_ids`, every id has an OK coverage row | Complete |
| Code spot-checks | `event_organisers`, `event_lock_managed`, `notice_facts_event` and `timed_checks_run_system` exist as the design describes | The cross-unit references resolve. The findings above come from the task facade and the U9 grant precedent. |

### Summary

The security design is sound and traceable: three helpers decide every right, hidden and made-up ids answer alike, internal functions have no signed-in grant, and the tables are reachable only through the functions. The one gap to weigh before approving is the event-link refusal, which as written would break edits of existing event-linked tasks. The other four items are minor clarifications.
