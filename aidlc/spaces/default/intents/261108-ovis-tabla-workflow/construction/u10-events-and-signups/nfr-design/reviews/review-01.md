## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-17T14:25:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-design/security-design.md > Authorization Architecture > Event commands | The design says the tale and roles may be changed by "a parent marked as organiser for the tale and roles as BR106.1 says". BR106.1 only defines who is told about an event. BR106.2 says an organiser mark gives no right to edit, and BR100.1, BR105.3 and BR107.1 limit tale and role changes to a super admin or the group's coordinator. A developer following this sentence would give organisers edit rights, which widens access beyond the rules and contradicts the "no edit right" decision in the rules summary. | Remove the organiser clause. State that one manager decision (super admin, or the coordinator of the event's group) covers event, notices, tale and roles, and that an organiser mark adds no right. Add an "out of reach" test for a marked organiser. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-design/reliability-design.md > Database rules (NFR7.3, NFR7.4) | The design says "check and unique constraints" enforce the 20-role limit, and that a role's "person check" allows neither person only through the removal function. A CHECK cannot count rows and cannot know which function is calling. The requirement is that the database itself refuses these cases when a test inserts as the database owner. The food-off rule is placed only "inside the add function", so a direct owner insert is not refused either. A developer cannot build the stated mechanism and would have to invent one. | Name a mechanism that works: a trigger or a locked count for the 20-role limit; an explicit removed marker, or a relaxed check plus a trigger, for the cleared role; and either a trigger for food-off or a restated NFR7.3 pass criterion that tests that case through the function. | New |
| R-03 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-design/performance-design.md > Writes (NFR9.2) | Cancelling "closes the event's open tasks with one set-based update". BR118.1, BR122.1 and NFR5.6 require task rows to be locked in ascending id order after the event row, and scalability-design.md says the same. A single UPDATE gives no lock-order guarantee, so it can deadlock with another command that locks two task rows in ascending order. The two designs disagree and the deadlock-free claim is not established. | State that cancel first selects the open task ids in ascending order with a row lock under the event lock, then updates them. Keep the one set-based statement for the write. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-design/scalability-design.md > Locking | Event commands lock the event row first. Sign-up and offer change, withdraw and manager removal start from a row id, so the event id must be read before the event lock exists. The design does not say how the order is kept, for example read the event id, lock the event, then lock and re-check the row. The removal pair (C16) is also not covered. It changes role, sign-up and offer rows without the event row, and the design does not state its ascending-id order within each kind. | Describe the read, lock, re-check step for row-based commands. Add a short statement that the removal pair locks each kind by ascending id and never takes an event lock after a row lock. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-design/security-design.md > Authorization Architecture > Sign-ups and offers | Same denied result for a real row of another family and a made-up id is specified only for the owner's change and withdraw. The manager's removal function (BR110.2) looks the row up first to find its event. A non-manager calling it with a real id and with a made-up id must also get an identical denied result, otherwise row existence leaks. | Add that the manager removal function returns the same denied refusal for a non-manager on a real row and on an unknown id, and list it in the out-of-reach test. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Traceability check by hand | All 46 requirement IDs (NFR1.1 to NFR11.2) in the unit's requirements appear in nfr-design/traceability.json. Every named target file exists and holds a matching design row | Coverage is complete. The problems are in what some rows say, not in what is missing. |
| Real names or contact details | None found in the seven files | Pass |
| Implementation code | None found; the designs are prose and tables | Pass |

### Summary

Coverage is complete and the design is mostly consistent with C1, C8 and C16. One security statement grants organisers edit rights that the rules explicitly withhold. Two database and locking mechanisms (constraints that cannot do what is claimed, and a cancel step that does not keep the lock order) need correcting before a developer can build from this design.
