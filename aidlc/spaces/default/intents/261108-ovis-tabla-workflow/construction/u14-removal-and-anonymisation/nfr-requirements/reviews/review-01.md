## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-25T19:10:03Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u14-removal-and-anonymisation/nfr-requirements/security-requirements.md > NFR1.3, NFR1.4 | The owner's answers Q1 and Q2 change behaviour that the frozen design states the other way. BR204.1 and the design's open point say a parent removed alone keeps the stored name; BR204.2 and BR206.4 empty only sign-up and food-offer notes at removal, and contribution notes and request reasons only on anonymise. NFR1.3 now empties checklist-claim notes, recurring-duty skip reasons and swap/cancellation reasons at removal, and NFR1.4 renames a single removed parent at once. NFR1.3 also reaches into the checklists, recurring-duties and dutychanges steps, which the design never touched. Nothing says which text wins, so a developer reading the rules first will build the old behaviour. | Add a short "overrides the design" list (NFR1.3, NFR1.4, plus the carried R-01, R-02, R-03, R-05 and R-07 items) that names the rule it replaces and the step each text change belongs to. Say that where they differ, the requirements win, and that the code plan lists the touched steps. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u14-removal-and-anonymisation/nfr-requirements/security-requirements.md > NFR3.2, NFR3.3 | A super admin who removes their own family (NFR3.3 mentions the case) has their own session ended after the commit, so the result page and its flagged-items read (NFR4.4) are refused for them. A requirement for what that administrator sees is missing. Also, ending sessions after the commit can fail on its own (the app already emits `sessions_end_failed` for this); only the database check then protects. No requirement covers a failed end-of-session call. | Add a requirement for the self-removal screen (for example a signed-out confirmation or a result carried in the C1 result). Add one that a failed session-ending call is logged with the account count only and does not undo the removal, since the deactivated account is already refused. Test both. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u14-removal-and-anonymisation/nfr-requirements/security-requirements.md > NFR3.3 | The last-super-admin check counts active accounts, and each parent is deactivated in turn. The test list names "alone and as a family member" only. The case where a family holds all remaining super admins, or the caller plus one other, behaves differently (the second parent is the last one). | Add tests for a family holding every super admin and for the caller's own family with another super admin outside it. State that preview must predict the refusal for the whole family, not per parent. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u14-removal-and-anonymisation/nfr-requirements/reliability-requirements.md > NFR5.1 | The command now locks every task and place row of the family before the first step. The project's own correction records that an added wrapper-level lock broke the timing of existing lock tests. NFR5.1 and NFR5.7 do not say how the existing lock tests are checked. | Add to NFR6.2 that the existing lock and deadlock tests of the duty, swap and reminder areas run unchanged after the new lock order, and list any that need a change. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u14-removal-and-anonymisation/nfr-requirements/security-requirements.md > NFR1.3 | Review finding R-04 (the done mark keeps the removed parent's id, which departs from contract C16's "clears doneBy") is not carried, and NFR1.3/NFR1.5 do not mention it. Later units will read C16. Also the emptied texts are not listed on the restore screen's "does not come back" text (BR207.1), so an administrator may expect them back within 30 days. | Record the kept done-mark id as a deliberate change to C16. Add emptied texts to the list the restore screen shows. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| (none declared) | Not run | Read instead: `identity_end_parent_sign_in` returns the account id, deactivates the account, bumps its authorization version and clears `parents.account_id`, so NFR3.1 to NFR3.3 and NFR3.6 match the database. `identity_lock_super_admins` counts active accounts only, which explains the last-super-admin finding. Session-ending code with a `sessions_end_failed` event exists in `src/identity/`. |

### Summary

The requirements are measurable, trace to the design review's carried findings and fit the existing database and session code. The main risk is that Q1 and Q2 now contradict rules the design keeps frozen, with no list saying which wins; the other points are gaps in the self-removal and failure paths.
