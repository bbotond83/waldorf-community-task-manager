# Entities: u8-animal-care-and-information

The data shape for the daily animal-care slots, the fair-share reminder round and the information page. Built from `unit-of-work.md` (U8), `unit-of-work-story-map.md` (US7.1 to US7.3, US10.1, US10.2), `stories.md`, `requirements.md` (FR4.4, FR7.1 to FR7.6, FR10.1 to FR10.5, FR17.1, FR17.3, NFR3, NFR5, NFR9, NFR10), `components.md` (AnimalCareSignup, DutyChanges, Information, TimedChecks, WebApplication), `contract-summary.md` (C1, C3, C4, C5, C7, C8, C9, C10, C16, C18, C19, C20), `decisions.md` (ADR-012) and the owner's answers Q1 to Q8 in `functional-design-questions.md`. Contains no names or contact details.

As in U2, U6 and U7, a *duty* is a task row and a *place* is an assignment row. A slot is a duty with origin `animal_slot` and one place; the family that holds the place holds the slot. This unit adds no person field to any of its own entities, so the removal contract (C16) needs no function from U8: a removed family's slots are places, which U2's block already covers.

## Entity Model

```yaml
entities:
  - name: SlotCalendar
    description: The animal-care settings of one school year - the two start times and the working group whose coordinators are alerted about empty slots - and when the year's slots were last created.
    owner: AnimalCareSignup
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: schoolYearId, type: reference, required: true, unique: true, references: SchoolYear, note: "one calendar per school year" }
      - { name: morningStart, type: local time, required: true, default: "07:30", note: "Budapest time (Q1)" }
      - { name: afternoonStart, type: local time, required: true, default: "16:00", note: "Budapest time (Q1)" }
      - { name: careGroupId, type: reference, required: false, references: WorkingGroup, note: "the group whose coordinators get the day-before alert (AC7.3.2); set to the year's Állatgondozás group when the calendar is made" }
      - { name: generatedAt, type: timestamp, required: false, note: "when slots were last created; null until the first time" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - morningStart is earlier than afternoonStart.
      - careGroupId, when set, names a working group of the same community and school year.
    relationships:
      - { to: SchoolYear, cardinality: "1..1", direction: "calendar -> year" }
      - { to: AnimalSlot, cardinality: "0..*", direction: "calendar -> slots" }

  - name: AnimalSlot
    description: One morning or afternoon of one weekday; the origin of exactly one slot duty. It holds no person - who holds the slot is the duty's place.
    owner: AnimalCareSignup
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true, note: "the duty's origin id (C4)" }
      - { name: calendarId, type: reference, required: true, references: SlotCalendar }
      - { name: slotDate, type: date, required: true, note: "Monday to Friday, school-break weeks included (FR7.1)" }
      - { name: part, type: enum, required: true, allowed: [morning, afternoon] }
      - { name: dutyId, type: reference, required: true, unique: true, references: Duty, note: "origin_kind animal_slot, capacity 1, no working group, source slot_generated (C4). Creating a slot makes only the duty, with no place; a place is made when a family signs up and is released when it gives the slot up" }
    constraints:
      - (calendarId, slotDate, part) is unique, so creating slots twice never makes a second slot.
      - slotDate falls in one of the weeks of the calendar's school year (C3 school_weeks).
      - The duty starts at slotDate plus the calendar's start time for the part, in Budapest time, and ends one hour later.
    relationships:
      - { to: SlotCalendar, cardinality: "1..1", direction: "slot -> calendar" }
      - { to: Duty, cardinality: "1..1", direction: "slot -> duty" }

  - name: Duty
    description: Existing (U2). This unit adds the origin kind animal_slot; nothing else changes.
    owner: Duties
    change: changed
    attributes:
      - { name: originKind, type: enum, required: true, allowed: [manual, rota_week, weekend_slot, animal_slot], note: "animal_slot is new; the other three are the values in use today (U2, U6)" }

  - name: Place
    description: Existing (U2). A slot has at most one active place. Signing up creates it for the caller's family (C18); giving the slot up releases it (C5 place_release) and the slot is free again.
    owner: Duties
    change: unchanged

  - name: FairShareRound
    description: The record that the monthly fair-share reminders of one school year and one month were worked out, so the reminder is decided once per month even if the daily run runs more than once (Q4).
    owner: AnimalCareSignup
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: calendarId, type: reference, required: true, references: SlotCalendar }
      - { name: month, type: year-month, required: true }
      - { name: decidedOn, type: date, required: true, note: "the Budapest date of the run that worked it out" }
      - { name: averageAtRound, type: decimal, required: true, note: "the full-year average on that day, kept for checking" }
      - { name: familiesReminded, type: integer, required: true, min: 0 }
    constraints:
      - (calendarId, month) is unique.
    relationships:
      - { to: SlotCalendar, cardinality: "1..1", direction: "round -> calendar" }

  - name: InfoSection
    description: One section of the information page. Every signed-in member reads the visible sections; the owning group's coordinators edit its text and super admins edit everything (FR10.1, FR10.2).
    owner: Information
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: key, type: text, required: true, note: "stable English key, also the page anchor: morning, afternoon, watering, saturday-cleaning, animal-feeding, big-cleaning; new sections get a key made from their title" }
      - { name: title, type: text, required: true, min: 1, max: 120, note: "Hungarian, for example Reggeli teendők" }
      - { name: body, type: text, required: true, max: 20000, note: "simple formatting: paragraphs, bulleted and numbered lists, bold, links (Q8)" }
      - { name: owningGroupName, type: text, required: false, max: 120, note: "the name of the owning working group, for example Állatgondozás. Working groups exist per school year and their names are unique within a year, so the owner is the group of that name in the school year current today (C3 school_year_for); a new year's group of the same name takes over without any change. Null, or no group of that name in the current year, means only super admins edit (BR87.6)" }
      - { name: seasonMonths, type: integer list, required: false, allowed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "months in which a duty card links to it; null is all year. Watering is 3 to 10 (FR10.4). The page itself always shows the section" }
      - { name: position, type: integer, required: true, min: 1, note: "order on the page" }
      - { name: hidden, type: boolean, required: true, default: false, note: "a hidden section is restorable (Q7)" }
      - { name: updatedAt, type: timestamp, required: true }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - (communityId, key) is unique.
      - owningGroupName is compared without regard to letter case, as the group name's own uniqueness is.
      - The section keeps no editor's name: who edited is not shown, so removal has nothing to clear (C16).
    relationships:
      - { to: WorkingGroup, cardinality: "0..1", direction: "section -> the current school year's group of that name, resolved on each check" }
```

## Summary

| Entity | New or changed | Purpose |
|---|---|---|
| SlotCalendar | new | One school year's start times, alert group and creation time |
| AnimalSlot | new | A weekday morning or afternoon, the origin of one slot duty |
| Duty | changed | Gains the origin kind `animal_slot` |
| Place | unchanged | The family holding a slot |
| FairShareRound | new | One month's fair-share reminder decision, so it runs once |
| InfoSection | new | A section of the information page with its owner and season |

The fair-share counts and the empty-slot lists are worked out on reading, not stored: they come from the slot places and the family standings (C20), so they are never out of date.
