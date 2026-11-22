# Entities: u9-recurring-duties

The data shape for repeating duties and their done marks. Built from `unit-of-work.md` (U9), `unit-of-work-story-map.md`, `stories.md` (US9.1 to US9.4 and the recurring-duty part of US17.1), `requirements.md` (FR1.6, FR2.3, FR9, FR17.4, A5, NFR3 to NFR5, NFR10), `components.md` (RecurringDuties, RotaPlanning, Duties, TimedChecks, WebApplication), `contract-summary.md` (C1, C2, C3, C6 to C9, C12, C14, C16) and the owner's answers Q1 to Q7 in `functional-design-questions.md`. Decisions are ADR-002, ADR-003 and ADR-010 in `decisions.md`. Contains no names or contact details.

Only what this unit adds is listed. Working groups, parents, families, rota weeks and notices keep the shape earlier units gave them. A *duty* and a *place* are the rows today's code calls a task and an assignment.

## Entity Model

```yaml
entities:
  - name: RecurringSchedule
    description: A rule that says a job repeats, how often, in which months, and who owns it. The next due date always counts from the rule, never from the last done mark.
    owner: RecurringDuties
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: title, type: text, required: true, min: 1, max: 200 }
      - { name: category, type: text, required: true, min: 1, max: 100, default: "általános", note: "free label such as nyúl, játszótér, kert; used to group the list" }
      - { name: ownerKind, type: enum, required: true, allowed: [group, family, rota_week] }
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup, note: "set exactly when ownerKind is group (Q3)" }
      - { name: familyId, type: reference, required: false, references: Family, note: "set exactly when ownerKind is family" }
      - { name: rotaJob, type: enum, required: false, allowed: [indoor_cleaning, front_garden, water_carrying, weekend_animal_care], note: "set exactly when ownerKind is rota_week; the job whose family owns each occurrence (C12)" }
      - { name: intervalKind, type: enum, required: true, allowed: [weeks, rota_weeks], note: "weeks count calendar weeks; rota_weeks count published weeks of the rota job, so break weeks do not count (Q5). rota_weeks only with ownerKind rota_week" }
      - { name: intervalCount, type: integer, required: true, min: 1, max: 52 }
      - { name: startDate, type: date, required: true, note: "the first due date for weeks; the anchor week for rota_weeks" }
      - { name: seasonFromMonth, type: integer, required: false, min: 1, max: 12 }
      - { name: seasonToMonth, type: integer, required: false, min: 1, max: 12, constraints: [not before seasonFromMonth; both set or both empty; a season does not wrap over New Year] }
      - { name: isActive, type: boolean, required: true, default: true, note: "false for the rabbit items while there are no rabbits (FR9.4)" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A schedule has exactly one owner field set, matching ownerKind (BR142.3).
      - A group-owned schedule belongs to an active working group of the same community (U1).
      - intervalKind rota_weeks is allowed only for a rota-week-owned schedule.
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: RecurringSchedule to WorkingGroup, note: optional }
      - { to: Family, cardinality: many-to-one, direction: RecurringSchedule to Family, note: optional }
      - { to: RecurringOccurrence, cardinality: one-to-many, direction: RecurringOccurrence to RecurringSchedule }

  - name: RecurringOccurrence
    description: One due date of a schedule. It carries its own done mark (ADR-003) and its own reminder bookkeeping. It is a record of this unit, not a duty row (see the assumptions in functional-spec.md).
    owner: RecurringDuties
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: scheduleId, type: reference, required: true, references: RecurringSchedule }
      - { name: dueDate, type: date, required: true }
      - { name: rotaWeekId, type: reference, required: false, references: RotaWeek, note: "for a rota-week-owned schedule, the week this occurrence belongs to; the owning family is read live through C12, so a swap or reassignment of that week moves the occurrence with it (Q5)" }
      - { name: status, type: enum, required: true, allowed: [open, done, skipped], default: open }
      - { name: doneByParentId, type: reference, required: false, references: Parent, note: "set exactly when status is done; cleared by removal (C16); shown through C6" }
      - { name: doneAt, type: timestamp, required: false }
      - { name: skippedReason, type: text, required: false, min: 1, max: 200, note: "set exactly when status is skipped" }
      - { name: skippedByParentId, type: reference, required: false, references: Parent }
      - { name: dueNoticeSentAt, type: timestamp, required: false }
      - { name: overdueNoticeSentAt, type: timestamp, required: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - One occurrence per schedule and due date.
      - doneByParentId and doneAt are both set when status is done and both empty otherwise.
      - skippedReason is set when status is skipped and empty otherwise.
      - "Overdue" is not stored: an open occurrence whose due date has passed (Budapest date) is overdue (BR146.1).
    relationships:
      - { to: RecurringSchedule, cardinality: many-to-one, direction: RecurringOccurrence to RecurringSchedule }
      - { to: RotaWeek, cardinality: many-to-one, direction: RecurringOccurrence to RotaWeek, note: optional }
      - { to: Parent, cardinality: many-to-one, direction: RecurringOccurrence to Parent, note: "done by and skipped by; optional" }

  - name: RecurringNoticeKinds
    description: Two registered notice kinds and one target type that this unit adds to the notice registry of U5 (C8). Not a table of this unit; rows in U5's registry tables.
    owner: Notifications
    change: new rows only
    attributes:
      - { name: recurring_due, type: text, required: true, note: "notice kind, target type recurring_duty" }
      - { name: recurring_overdue, type: text, required: true, note: "notice kind, target type recurring_duty" }
      - { name: recurring_duty, type: text, required: true, note: "target type; its facts function returns the title and the link to the occurrence" }
```

## Summary

Two things are new: a schedule (the rule) and an occurrence (one due date with its done mark). A schedule is owned by a group, a family or a rota job. An occurrence is created ahead of time by the daily run, is shown to its owner, and is closed by a done mark or a skip. The bottle-cleaning interval is the interval of one rota-week-owned schedule, so no separate setting exists. Notice kinds are rows in U5's registry.
