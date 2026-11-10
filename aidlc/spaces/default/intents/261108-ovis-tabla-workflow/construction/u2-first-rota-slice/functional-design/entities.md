# Entities: u2-first-rota-slice

The data shape for the school calendar, the shared duty model and the first rota (indoor cleaning). Built from `unit-of-work.md` (U2), `unit-of-work-story-map.md`, `stories.md` (US4.1, US5.1 to US5.3, US8.1), `requirements.md` (FR4, FR5, FR8.1, NFR3 to NFR5), `components.md` (Community, Duties, RotaPlanning), `contract-summary.md` (C1 to C6, C18) and the owner's answers in `functional-design-questions.md`. Decisions are ADR-002 and ADR-004 in `decisions.md`. Contains no names or contact details.

Only what this unit changes or adds is listed. Family, Parent, Community, WorkingGroup and the role records keep the shape U1 gave them.

**Names.** `contract-summary.md` (C1) says a *duty* and a *place* are the rows today's code calls a task and an assignment. This unit keeps those two tables and gives them the extra fields below; it renames nothing.

## Entity Model

```yaml
entities:
  - name: SchoolYear
    description: A school year. U1 left it unchanged; U2 adds the changeover date.
    owner: Community
    change: changeoverDate added
    attributes:
      - { name: changeoverDate, type: date, required: true, default: 1 July of the calendar year in which endsOn falls, constraints: [not before startsOn] }
    constraints:
      - Existing rows and rows created without a value get the default.
      - The date may fall after endsOn (a year that ends on 30 June has its changeover on 1 July).
    relationships:
      - { to: BreakWeek, cardinality: one-to-many, direction: BreakWeek to SchoolYear }
      - { to: RotaPlan, cardinality: one-to-one, direction: RotaPlan to SchoolYear, note: at most one plan per school year }

  - name: BreakWeek
    description: One school-break week of a school year. Every rota reads it as a week with no duty (a weekend rota, added later, ignores it).
    owner: Community
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: schoolYearId, type: reference, required: true, references: SchoolYear }
      - { name: weekStart, type: date, required: true, constraints: [a Monday] }
      - { name: label, type: text, required: false, max: 100 }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - One break week per school year and weekStart.
      - weekStart is the Monday of a school week of that year (see "School week" below).
    relationships:
      - { to: SchoolYear, cardinality: many-to-one, direction: BreakWeek to SchoolYear }

  - name: RotaPlan
    description: The yearly rota of one school year. It holds one row per week for each rota (U2 has one rota, indoor cleaning). It is a draft until published.
    owner: RotaPlanning
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: schoolYearId, type: reference, required: true, references: SchoolYear, constraints: [unique] }
      - { name: status, type: enum, required: true, allowed: [draft, published], default: draft }
      - { name: publishedAt, type: instant, required: false, constraints: [present exactly when status is published] }
      - { name: publishedBy, type: reference, required: false, references: Account, constraints: [present exactly when status is published] }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - Published is final in this unit. There is no way back to draft (a draft is discarded instead, BR21.5).
    relationships:
      - { to: SchoolYear, cardinality: one-to-one, direction: RotaPlan to SchoolYear }
      - { to: RotaWeek, cardinality: one-to-many, direction: RotaWeek to RotaPlan }

  - name: RotaWeek
    description: The family on one rota for one week of a plan.
    owner: RotaPlanning
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: planId, type: reference, required: true, references: RotaPlan }
      - { name: job, type: enum, required: true, allowed: [indoor_cleaning], note: U6 adds front_garden, water_carrying and weekend_animal_care }
      - { name: weekStart, type: date, required: true, constraints: [a Monday] }
      - { name: familyId, type: reference, required: false, references: Family, note: id only, checked inside functions (ADR-010) }
      - { name: emptyReason, type: enum, required: false, allowed: [no_family, cleared], constraints: [empty whenever familyId is set; may be empty when familyId is empty, for example on a break week, and the screen then says only that the week is empty], note: no_family means the draft found no family to give it, cleared means an administrator emptied it }
      - { name: changedByAdmin, type: boolean, required: true, default: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - One row per plan, job and weekStart. A plan holds a row for every school week of its year, break weeks included (their family stays empty).
      - weekStart is a school week of the plan's year.
      - changedByAdmin becomes true when an administrator sets or clears the week by hand and never goes back.
    relationships:
      - { to: RotaPlan, cardinality: many-to-one, direction: RotaWeek to RotaPlan }

  - name: Duty
    description: Today's task record, which this unit makes the shared duty model (ADR-002). U2 adds where a duty came from.
    owner: Duties
    change: originKind and originId added
    attributes:
      - { name: originKind, type: enum, required: true, allowed: [manual, rota_week], default: manual, note: later units add values }
      - { name: originId, type: identifier, required: false, note: the RotaWeek id when originKind is rota_week }
    constraints:
      - originId is present exactly when originKind is not manual.
      - One duty per originKind and originId.
      - A rota duty has no working group (it is community-wide, which U1 already allows: `tasks.group_id` is nullable and the reach rules and the teacher schedule treat a duty with no group as community-wide) and no event, capacity 1, and starts on the Monday of its week at 00:00 and ends on the Sunday at 23:59:59, Budapest time.

  - name: Place
    description: Today's assignment record, which this unit makes the shared place model. U2 adds the done mark and the rota source.
    owner: Duties
    change: doneAt and doneBy added; source gains rota_publish
    attributes:
      - { name: source, type: enum, required: true, allowed: [parent_sign_up, admin_assign, swap, rota_publish] }
      - { name: doneAt, type: instant, required: false }
      - { name: doneBy, type: reference, required: false, references: Parent, note: id only }
    constraints:
      - doneAt and doneBy are both present or both empty.
      - A done mark is never changed once set.
      - A place of a rota duty has no parent who signed up.

  - name: RotaNotice
    description: The in-app notice a parent receives when a rota is published, listing their family's weeks. Stored in today's notices with a new kind.
    owner: Notifications
    change: kind rota_published and target rota_plan added to today's notices; the task link is empty for this kind
    attributes:
      - { name: kind, type: enum, required: true, allowed: [rota_published] }
      - { name: targetType, type: enum, required: true, allowed: [rota_plan] }
      - { name: targetRef, type: reference, required: true, references: RotaPlan }
    constraints:
      - One notice per parent with an account and one plan (the duplicate key is built from kind, plan and parent).
      - The text is built when the list is read, from the duties the family then holds on that plan, so it names no one else.
```

## School week

A school week is a Monday-to-Sunday week of which at least one weekday (Monday to Friday) falls from the school year's `startsOn` to `endsOn`, both included. Every date in this unit that names a week is that week's Monday. The week of a date is found in Budapest time.

## Summary

| Entity | Change in this unit |
|---|---|
| SchoolYear | Gains the changeover date. |
| BreakWeek | New. |
| RotaPlan, RotaWeek | New. One plan per school year; one row per school week and rota. |
| Duty (today's task) | Gains where it came from (`originKind`, `originId`). |
| Place (today's assignment) | Gains a done mark and the `rota_publish` source. |
| RotaNotice | New notice kind in today's notices. |

**Not in this unit.** Family standing (staying, leaving, new) and the eligibility check belong to U6, so the draft here treats every active family as present for the whole year. The other three rotas, weekend picks, swaps and the new notification function arrive in U6 and U7.
