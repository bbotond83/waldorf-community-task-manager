## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-22T12:28:12Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u9-recurring-duties/nfr-requirements/scalability-requirements.md > NFR5.8 | NFR5.8 says the lock order of C1 holds and places the schedule row after family and rota week and before occurrence rows. The C1 step list is family, rota week, weekend pick, change request, duty, place, checklist task, to-do task, book, and has no step for schedule or occurrence rows. BR141.2 in rules.md still says the schedule row is locked first. The two statements disagree, and C1 is not amended, so NFR5.8 does not actually settle the point. A command must also read the schedule to learn its owner kind before it can lock the family or rota week. NFR5.8 does not say how that read is done safely. | Record the schedule and occurrence steps as a C1 amendment: place them after rota week and before or after weekend pick, as chosen, so other units see them. Correct BR141.2 to match. State that the owner kind and owner id are immutable, so an unlocked pre-read followed by the lock and a re-check is safe. Say the daily check and the removal apply take schedules in ascending id order. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u9-recurring-duties/nfr-requirements/reliability-requirements.md > NFR7.4 | The catch-up rule is ambiguous at the boundary. The due notice is sent for occurrences due "today or earlier ... within 3 days of the due date". The overdue notice is sent at "3 or more days past due". On day 3 both conditions hold, so after a missed run a family gets "Esedékes" and "Lejárt" in the same run. A missed run also sends a due notice up to 3 days late, which disagrees with BR149.1, where the due notice goes out on the due date. The tests check days 2, 3 and 4 but do not say what each day should produce. | Define the window exactly, for example due notice on days 0 to 2, overdue notice from day 3, and no due notice once the overdue one applies. Add the expected notice or notices for each tested day. Update BR149.1 to say that a missed run sends a late due notice. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u9-recurring-duties/nfr-requirements/reliability-requirements.md > NFR7.3 and NFR7.8 | NFR7.3 has the database refuse a done occurrence with no person. NFR7.8 relaxes that rule when a removed parent's person is cleared. Neither says how the database tells the cleared case from an invalid one, so the check either blocks the removal or lets invalid rows through. | Name the marker, for example a flag column or "former member" state, and make the NFR7.3 constraint allow no person only when it is set. Add a test for both sides. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u9-recurring-duties/nfr-requirements/security-requirements.md > NFR3.3 and NFR3.5 | A super admin can read a family-owned occurrence (NFR3.5) but is refused mark-done unless they are one of the owner people (NFR3.3). NFR3.4 lets a super admin undo. This asymmetry is not stated as intended, and no test case covers a super admin on family-owned and rota-week occurrences. | Confirm the asymmetry is intended and add a super-admin row for read, mark-done, undo and skip to the NFR3.10 matrix. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u9-recurring-duties/nfr-requirements/performance-requirements.md > NFR9.3 | The "under 5 seconds" criterion for the daily check does not say it includes notice creation and sending for the whole run, or the case where many occurrences are due at once. | State the workload, for example all schedules due, with notices created and email sending mocked. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual traceability check | NFR1 to NFR11 all appear in traceability.json. NFR2 is N/A with a reason. Every listed target id (NFR1.1 to NFR11.2) exists in the files. | Coverage is complete. |
| Manual BR check | BR141, BR143.2, BR143.3, BR144.1, BR144.2, BR145.1 to BR145.3, BR146.3, BR147.2, BR149.2, BR150.1, BR151.1 and BR152.1 all exist in rules.md. | Citations resolve. |
| Manual contract check | C1 step list has no schedule or occurrence step. C8, C9 and C12 usage matches the contract text. | Basis for the NFR5.8 finding. |

### Summary

The NFRs cover every inception NFR with measurable pass criteria, and the cited rules and contracts resolve. The two points the design review left open are not yet fully settled. NFR5.8 conflicts with BR141.2 and with the C1 step list, and NFR7.4 has an overlapping notice window. Both should be fixed before code generation, but they do not block the stage.
