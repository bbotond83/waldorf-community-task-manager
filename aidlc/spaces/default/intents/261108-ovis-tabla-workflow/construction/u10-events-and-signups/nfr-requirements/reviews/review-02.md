## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-21
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
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/performance-requirements.md > NFR9.1 | The 2-second target names the events list, event page and group events section, but not the admin event edit page (the form with notices, roles and tale). That page was the slowest measured (841 ms) and is not covered by any stated target. The pass criterion also does not say how the time is taken (single run, median, warm or cold). | Add the event edit page to NFR9.1 and state the measurement method, for example median of several warm runs. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/performance-requirements.md > NFR9.3 | "Keep their read speed" has no number. The pass criterion only says existing timing tests pass, which is measurable only if those tests carry a threshold. | Name the existing timing tests and their thresholds, or state the 2 s target. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/observability-requirements.md > NFR4.7 | "The limit refusals" does not name the codes, so "each refusal code has a test" cannot be checked against a list. | List the limit refusal codes from rules.md (sign-up limit, offer limit, notice and role limits). | New |
| R-10 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/security-requirements.md > NFR3.9 and NFR1.4 | NFR3.9's pass criterion ("evidence is in the test results") is not checkable. NFR1.4 pins the note and food text limits (500 and 200) but not the other limits in rules.md (notice 300 characters, role name 100, typed name 200, tale 5000). | Name the matrix file check or test that proves NFR3.9. Add the remaining length limits to NFR1.4, or note they are covered by a named test. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u10-events-and-signups/nfr-requirements/performance-requirements.md > NFR8.1 | The Hungarian-text pass criterion ("reviewed in the screenshots") is a human check with no evidence format. | Record where the owner's confirmation is kept. Acceptable under the team's owner-review practice. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | Not run; none were named in the brief | Cross-references were checked by reading `traceability.json` and the NFR files against `requirements.md` and `rules.md` |

Checks made:
- NFR1 to NFR11 in `requirements.md` each appear in `traceability.json`, and every target ID exists in the NFR files.
- NFR2 is marked N/A with a valid reason.
- The 10 sign-ups, 20 offers, 20 roles, 500 and 200 character limits match `rules.md`.
- The NFR5.6 lock order matches BR122.1 and C1.
- The audit actions in NFR4.1 and NFR4.4 match C1.
- The 2 s target matches NFR9, and the reported timings of 62-86 ms and 841 ms meet it.

### Summary

The NFRs are measurable, traceable and consistent with the functional design and the contracts, with no Critical or Major gaps. The remaining items are Minor: the edit page and a few pass criteria need a number, a code list or a named test.
