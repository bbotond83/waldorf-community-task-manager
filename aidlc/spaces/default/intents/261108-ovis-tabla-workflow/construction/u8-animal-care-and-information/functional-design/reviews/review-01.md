## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T04:05:26Z
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

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json checked by hand | PASS | All 14 ACs of US7.1, US7.2, US7.3, US10.1 and US10.2 match stories.md and are covered. Every target BR exists in rules.md. BR82.1 to BR82.5 and BR89.1 appear in reverse with reasons, and every other rule is a coverage target. |
| Spot checks against C19, ADR-012 and U7 BR71.3 | PASS | The refusal codes of BR82 match C19. BR71.3 exists in U7 as cited. SLOT_NOT_RELEASABLE matches U7 BR76.1. |
| Spot checks against migrations | PASS with notes | `tasks.group_id` is nullable and `tasks_one_per_origin` backs the re-creation rule. The origin-kind check lists only three values, so the new kind needs a forward migration, which the design implies. The existing `duty_sign_up` takes the duty id and version, as the design states. |
| Other sensors (required-sections, upstream-coverage, linter, type-check) | Not run | They were not run in this advisory pass. |

### Summary

The design is coherent, traces every acceptance criterion, and its give-up rules match C19 and ADR-012. The one issue worth weighing before approval is the ownership of the information sections across school years, since working groups are per year. The remaining points are small clarifications.
