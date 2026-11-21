## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-17T14:16:30Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/security-requirements.md > Authorization Requirements > NFR3.4 | NFR3.4 says "A teacher reads and changes nothing in events, sign-ups or offers" and asks for reach tests "on every new read". BR104.1 and BR104.3 say the opposite for reading: every signed-in person, teachers included, reads events with notices, roles, tale, sign-ups and offers; a teacher only changes nothing. A developer or tester following NFR3.4 would deny teachers the events list and event page. | Rewrite NFR3.4 so teachers are allowed every read of BR104.1 and refused every command. Keep the teacher-schedule sentence only if it is scoped to the schedule function. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/security-requirements.md > Audit > NFR4.1, and observability-requirements.md > NFR4.4 | NFR4.1 and NFR4.4 require an audit event for creating and changing an event. BR123.1 audits only cancellation, marking or unmarking an organiser role, a manager's removal of a sign-up or offer, clearing a typed name, and removal apply. The requirements invent create and change audits, and omit the organiser mark and the manager removals that BR123.1 and BR106.2 do require. | Align NFR4.1 and NFR4.4 with the BR123.1 action list: cancel, organiser mark and unmark, manager removal of a sign-up or offer, role clear and removal apply. Drop create and change, or have the rules add them first. | New |
| R-03 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/reliability-requirements.md > NFR7.5, against tech-stack-decisions.md > Structure change | NFR7.5 requires the structure change to keep existing events and tasks, tested by comparing row counts over a seeded database. tech-stack-decisions.md says "No data is migrated (invented test data, local reset)". The two cannot both hold, so the migration scope and its pass test are undefined. | Pick one. Either state that the migration preserves rows and fix the tech-stack row, or drop NFR7.5 and keep the reset. In the first case, say how the dropped fixed notes and coordinator name are handled. | New |
| R-04 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/reliability-requirements.md > NFR7.3 | NFR7.3 says the database refuses "an offer on an event with food sign-up off". BR102.1 and BR116.1 say turning food sign-up off keeps existing offers, and a parent may still change or withdraw one. A table-level rule would make switching it off fail, or block those edits. The refusal belongs to the add command only (BR113.1, FOOD_SIGNUP_OFF). | Remove this item from the table-level constraint list. Test FOOD_SIGNUP_OFF on the add function, and add a test that switching food off with offers present succeeds and the offers stay editable and withdrawable. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/observability-requirements.md > NFR4.5 and NFR4.6 | The rules do not say that coordinators read a group event's audit entries, or that the delivery-problems screen groups by kind and event. C8 says only that failures are visible to super admins on the existing screen. These are extra behaviours that no rule or contract backs. | Either mark both as additions and have the rules or contract state them, or reduce them to what C8 and BR123.1 say. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/security-requirements.md > NFR3.3 | NFR3.3 requires the same denied refusal for a real and a made-up row. BR110.1 says a sign-up already withdrawn answers as not found. The rules do not say that an unknown id is a denied refusal. | State which refusal an unknown or withdrawn id gets and keep the test consistent with BR110.1, or have the rules confirm denied. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual cross-check of traceability.json | NFR1 to NFR11 are all present. Every NFRx.y target id exists in the files. NFR2 is N/A with a reason. | Coverage is complete. The problems are in what some requirements say, not in the mapping. |
| Names and contact details | None found in the seven files | Privacy rule met. |
| Stack check | No new package, service or scheduler | Stays inside technology-stack.md. |

### Summary

The coverage is complete and measurable, but four requirements contradict the rules they cite: teacher read access (NFR3.4), the audit list (NFR4.1, NFR4.4), the migration scope (NFR7.5 against tech-stack-decisions.md), and a table rule on offers (NFR7.3). A developer would build the wrong behaviour from them, so I recommend revising before approval.
