# Entities: u6-full-rotas-and-weekend-picks

The data shape for family standing, the four yearly rotas and the weekend duties with their picks. Built from `unit-of-work.md` (U6), `unit-of-work-story-map.md`, `stories.md` (US4.2, US5.1, US5.3, US6.1, US6.2), `requirements.md` (FR4 to FR6, FR8.1, FR17, NFR3 to NFR5, NFR10), `components.md` (Community, RotaPlanning, Duties, TimedChecks), `contract-summary.md` (C1, C3 to C5, C8 to C12, C16, C18, C20) and the owner's answers Q1 to Q5 in `functional-design-questions.md`. Decisions are ADR-002, ADR-004, ADR-006 and ADR-011 in `decisions.md`. Contains no names or contact details.

Only what this unit adds or changes is listed. SchoolYear, BreakWeek, RotaPlan and the notice records keep the shape U2 and U5 gave them. As before, a *duty* and a *place* are the rows today's code calls a task and an assignment.

## Entity Model

```yaml
entities:
  - name: FamilyYearStatus
    description: Whether a family stays, leaves or is new in one school year. A family with no row is staying.
    owner: Community
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: familyId, type: reference, required: true, references: Family }
      - { name: schoolYearId, type: reference, required: true, references: SchoolYear }
      - { name: standing, type: enum, required: true, allowed: [staying, leaving, new], default: staying }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - One row per family and school year, created the first time a super admin sets the standing.
      - leaving means the family holds no duty from that year's changeover date on; new means it holds none before it.
      - The number of weeks a family is present in a year (active weeks) is computed from the school calendar and never stored.
    relationships:
      - { to: Family, cardinality: many-to-one, direction: FamilyYearStatus to Family }
      - { to: SchoolYear, cardinality: many-to-one, direction: FamilyYearStatus to SchoolYear }

  - name: RotaWeek
    description: The family on one rota for one week of a plan. U2 created it for indoor cleaning; this unit adds the other three rotas.
    owner: RotaPlanning
    change: job gains three values; emptyReason gains two values
    attributes:
      - { name: job, type: enum, required: true, allowed: [indoor_cleaning, front_garden, water_carrying, weekend_animal_care] }
      - { name: emptyReason, type: enum, required: false, allowed: [no_family, rule_clash, cleared, not_drafted], note: rule_clash means the only families left would break the same-week rule; not_drafted marks the rows added to a plan made before this unit }
    constraints:
      - A plan holds four rows for every school week of its year, one per job.
      - Indoor cleaning and water carrying have no family in a break week. Front garden and weekend animal care run every school week.
      - The weekend of a weekend_animal_care row is the Saturday and Sunday of its week.
      - Once the plan is published, familyId always names the family that holds the week's duty; the function that follows a duty change keeps it so (BR66.2).
    relationships:
      - { to: RotaPlan, cardinality: many-to-one, direction: RotaWeek to RotaPlan }
      - { to: WeekendSlot, cardinality: one-to-many, direction: WeekendSlot to RotaWeek, note: "only for weekend_animal_care rows, five each, once published" }
      - { to: WeekendPick, cardinality: one-to-one, direction: WeekendPick to RotaWeek, note: "only for indoor_cleaning and front_garden rows, at most one" }

  - name: WeekendSlot
    description: One of the five duties of a weekend. Created when the plan is published and never changed afterwards.
    owner: RotaPlanning
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: weekendWeekId, type: reference, required: true, references: RotaWeek, constraints: [a weekend_animal_care row] }
      - { name: slot, type: enum, required: true, allowed: [saturday_opening, saturday_closing, sunday_opening, sunday_closing, shelter_cleaning] }
    constraints:
      - One row per weekend week and slot, so every published weekend has exactly five.
      - Each row becomes exactly one duty (originKind weekend_slot) with one place.
      - shelter_cleaning can never be picked.
    relationships:
      - { to: RotaWeek, cardinality: many-to-one, direction: WeekendSlot to RotaWeek }
      - { to: Duty, cardinality: one-to-one, direction: Duty to WeekendSlot, note: by originKind and originId (ADR-010) }

  - name: WeekendPick
    description: The opening or closing that a picking week (indoor cleaning or front garden) has taken for its weekend.
    owner: RotaPlanning
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: rotaWeekId, type: reference, required: true, references: RotaWeek, constraints: [unique, an indoor_cleaning or front_garden row of a published plan] }
      - { name: weekendSlotId, type: reference, required: true, references: WeekendSlot, constraints: [unique, not shelter_cleaning, same plan and week as rotaWeekId] }
      - { name: source, type: enum, required: true, allowed: [family, administrator] }
      - { name: pickedAt, type: instant, required: true }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A picking week has at most one pick and a slot is picked at most once.
      - The picking family is the family of rotaWeekId. The pick stores no family or person of its own, so a later duty change cannot leave it out of date and removal has no person to clear.
      - While a pick exists, the slot's place is held by the picking week's family (BR63.9).
    relationships:
      - { to: RotaWeek, cardinality: one-to-one, direction: WeekendPick to RotaWeek }
      - { to: WeekendSlot, cardinality: one-to-one, direction: WeekendPick to WeekendSlot }

  - name: Duty
    description: The shared duty model of U2 (today's task record). This unit adds the weekend duties and three rota categories.
    owner: Duties
    change: originKind gains weekend_slot; four categories added
    attributes:
      - { name: originKind, type: enum, required: true, allowed: [manual, rota_week, weekend_slot], note: originId is the WeekendSlot id for weekend_slot }
      - { name: category, type: text, required: true, note: "adds rota_front_garden, rota_water_carrying, rota_weekend_opening, rota_weekend_closing and rota_shelter_cleaning beside rota_indoor_cleaning" }
    constraints:
      - A weekend_animal_care week has no weekly duty of its own; its five weekend-slot duties are the work.
      - A weekend-slot duty has no working group, capacity 1 and one place. An opening runs from 00:00 to 12:00 of its day, a closing from 12:00 to 23:59:59, and the shelter cleaning from Saturday 00:00 to Sunday 23:59:59, Budapest time.

  - name: Place
    description: The shared place model of U2 (today's assignment record).
    owner: Duties
    change: source gains weekend_pick
    attributes:
      - { name: source, type: enum, required: true, allowed: [parent_sign_up, admin_assign, swap, rota_publish, weekend_pick] }
    constraints:
      - A weekend-slot place is held by the weekend family (source rota_publish) or, while a pick exists, by the picking family (source weekend_pick).

  - name: NoticeKind
    description: U5's registry of notice kinds. This unit registers its own values; the record itself is unchanged.
    owner: Notifications
    change: six values registered
    attributes:
      - { name: kind, type: enum, required: true, allowed: [rota_week_reminder, weekend_pick_reminder, weekend_pick_overdue, weekend_pick_assigned, weekend_slot_returned, weekend_picker_missing], note: "all with target type task, the duty the notice is about; rota_published is already registered" }

  - name: TimedCheck
    description: U5's registry of checks for the daily run. This unit registers three; the record itself is unchanged.
    owner: TimedChecks
    change: three rows registered
    attributes:
      - { name: checkName, type: enum, required: true, allowed: [weekend_picks_reminder, weekend_picks_alert, rota_week_reminder], note: "weekend_picks_alert belongs to the Friday-noon run, the other two to the daily run" }
```

## Summary

| Entity | Change in this unit |
|---|---|
| FamilyYearStatus | New. Staying, leaving or new per family and school year; no row means staying. |
| RotaWeek | Three more rotas; two more reasons for an empty week. |
| WeekendSlot | New. Five per published weekend, each one duty. |
| WeekendPick | New. Which opening or closing a picking week took. |
| Duty (today's task) | New origin `weekend_slot` and the categories of the new rotas. |
| Place (today's assignment) | New source `weekend_pick`. |
| NoticeKind, TimedCheck | Six notice kinds and three checks registered. |

**One source for each fact.** Who holds a weekend duty is always its place. A pick only records which picking week took which slot. Flagged duties (a leaving or new family on the wrong side of the changeover date) are computed when read and never stored.

**Not in this unit.** Changing a published weekly duty, swaps and their requests belong to U7. The information page that duty cards will link to belongs to U8, and bottle cleaning to U9.
