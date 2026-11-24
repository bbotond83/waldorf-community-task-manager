## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/functional-design/rules.md > BR86.2, BR87.1; entities.md > InfoSection.owningGroupId | Working groups belong to one school year (the `groups` table carries `school_year_id`; entities.md itself ties `careGroupId` to "the same school year"). The six starting sections are owned by "the Állatgondozás group" and "Nagytakarítás szervezése", but the design does not say which year's group row the migration points at, nor what happens when no such group exists yet, or when a new school year brings new group rows. Coordinators of the new year's groups would then be refused (BR87.3) on their own sections until a super admin re-points every owner by hand. | State how ownership survives a year change: either resolve the owner by group name through the current year's group, or have the new-year step re-point owners. Also state what the migration does when the named group is missing (for example, null owner, only super admins edit). Add a rule and a test for it. | New |
| R-02 | Minor | rules.md > BR80.4 | A change of start times moves every future slot, including slots a family already holds, and no notice kind exists for it. A family that signed up for 07:30 could find 08:00 with no message. The 24-hour effect is accepted, but the silent change for holders is not discussed. | Either add a notice to holding families when their slot's time changes, or record explicitly that families are not told and why that is acceptable. | New |
| R-03 | Minor | rules.md > BR83.2, BR85.2; functional-spec.md > W6 | The rules say a family counts or is messaged when it "has a standing". C20 and `families_with_standing` in the migrations treat an active family with no standing row as staying. Read literally, the wording could exclude such families from the fair share and the warnings. | Reword to "every active family, with its standing from C20 (staying when no row exists)". | New |
| R-04 | Minor | entities.md > AnimalSlot, Place; rules.md > BR80.2 vs the scope paragraph | BR80.2 and the ER diagram say each slot duty is created "with one place", yet a free slot has "no active place". In the existing data a place is created only when a family signs up. The slot-creation step could be implemented either way. | Say plainly that creating a slot makes only the duty and that the place appears on sign-up (and ends on give-up), and fix the "one place" wording. | New |
| R-05 | Minor | rules.md > BR87.5 | A link is allowed if it is "a path inside the app". Without a stricter definition, a protocol-relative link such as `//host` could be read as an in-app path and lead off site. | Define an in-app path as starting with a single `/` and not `//`, and add a test case. | New |
| R-06 | Minor | functional-spec.md > Commands and reads, animal_slots_list | The read is said to decide which action is offered, but its output is not specified. Sign-up needs the duty's version and give-up needs the place's id and version (C18 and C19), and the row must also say whether the slot is in a swap and whether it is within 24 hours. | List the fields the row must return (duty id and version, place id and version, holder family name, in-swap flag, started flag, hours-to-start state). | New |
| R-07 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/functional-design/rules.md > BR81.6; functional-spec.md > Screens (Állatgondozás for teachers) and traceability.json > reverse | The decision that the teacher schedule leaves out the daily animal-care slots exists only as a sentence in the Screens list. No rule states it, and nothing in traceability.json names it. The built code does it in migration 20261069 (schedule_get filters out duties of origin animal_slot). It changes what an existing screen shows, and requirement FR8.1 says every parent sees who holds which duty "across all rotas". The rules do not say whether the exclusion also applies to other readers of duties. | Add a rule (for example BR81.7) saying the teacher schedule read omits slots of origin animal_slot and that teachers read them on the read-only page instead. Say what happens to other duty lists. Add it to the reverse table in traceability.json and name the test that covers it. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/functional-design/rules.md > BR85.1 | The text says the Saturday and Sunday runs list "Monday and Tuesday again". With the rule "dated D+1 to D+3", a Sunday run lists Monday, Tuesday and Wednesday. Only Saturday gives Monday and Tuesday. A tester would write the wrong expectation for Sunday. | Correct the Sunday example to Monday to Wednesday, or state that weekend runs are narrowed, and align the test. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/functional-design/rules.md > BR85.6 and BR85.1 | The rules say a check does nothing "with no calendar for the day's school year". The code selects the year of the run's day (school_year_for(D)) but looks for slots dated D+1 to D+3. On the day before a school year starts, or across the year boundary, the slots of the next year are skipped, so the first slots of a year get no warning on the days before. The design does not say whether this is intended. | State what happens when D is outside the year but D+1 to D+3 are inside it: warn, or knowingly skip. Add a test for the chosen behaviour. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/functional-design/rules.md > BR82.5 | The rule says nobody is notified on give-up. The code also re-plans the family's duty reminders for the slot (reminder_plan). The assumption list covers only the existing reminder before a duty starts. | Add to BR82.5 that the duty reminders for that slot are planned again without the family's place. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

### Verification

- Lock order: place_lock takes duties ascending, then places ascending, and slot_give_up and place_release use it. animal_slots_create locks the calendar row first, then inserts duties and slots. animal_calendar_save locks the calendar, then the duties dated after today ascending, and touches no places. This matches BR89.1 (calendar, then duties, then places). Sign-up and give-up use the existing duty-then-place order.
- Give-up: slot_give_up checks the holder, origin animal_slot, the 24-hour limit, an open swap or request, then the version, in the order BR82.1 to BR82.5 give. An open swap inside the last 24 hours therefore answers SLOT_GIVE_UP_TOO_LATE, which is consistent with the rules.
- First-save conflict: animal_calendar_save in migration 20261070 inserts with on conflict do nothing and returns VERSION_CONFLICT to the loser. This matches the decision in the assumptions list. Hidden-section handling in info_section_update (caller checked before the lock, a coordinator gets denied for a hidden section, a coordinator may change only the text) matches BR87.1, BR87.3 and BR87.6.
- Traceability: all fourteen upstream AC ids map to existing rules. The reverse entries for BR82.x and BR89.1 are justified by ADR-012, C19 and NFR5.
- Privacy: the artifacts contain no names or contact details. Lists return family display names only, as assumption A2 in requirements.md allows.
- Teacher page: read-only, with the list open to any signed-in member (BR81.6). It agrees with the rules apart from the missing schedule rule above.
- Source manifest paths read: migrations 20261068, 20261069 and 20261070. Tests were not re-run, as instructed.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | None named in the brief | Cross-references were checked by hand against the contracts and the migrations. |
| Test run | Not run, as instructed (the full run was reported as passing) | The review rests on reading the design and the code. |

### Summary

The design is implementable, and the migrations follow it, including the lock order, the 24-hour and open-swap give-up rules, the hidden-section rule and the first-save conflict. One Major gap (the teacher-schedule exclusion has no rule or traceability entry) and three Minor wording or edge-case points remain. None blocks building from this design.
