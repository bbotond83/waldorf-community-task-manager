# Entities: u11-checklists-and-templates

The data shape for checklist templates, the checklist each event copies from them, the people who take a task, and the two timed notices. Built from `unit-of-work.md` (U11), `unit-of-work-story-map.md`, `stories.md` (US12.1 to US12.3, US13.1), `requirements.md` (FR2.3, FR11.10 to FR11.12, FR12, FR13, FR17.3, FR17.4, NFR3 to NFR6, NFR10, NFR11), `components.md` (Checklists, Events, TimedChecks, WebApplication), `contract-summary.md` (C1, C2, C6 to C9, C13 to C16) and the owner's answers Q1 to Q8 in `functional-design-questions.md`. Decisions are ADR-001, ADR-005, ADR-006 and ADR-010 in `decisions.md`. Contains no names or contact details.

Only what this unit adds or changes is listed. Events, roles, parents, families, working groups and the notice records keep the shape U1, U3, U4, U5 and U10 gave them. As before, a *duty* is the row today's code calls a task.

`components.md` lists a TemplateTask with a section text and an EventChecklistTask with one `claimedBy`. The owner's answers need more: a task can have several helpers (Q2), and each section is for parents, organisers or teachers (Q4). So sections are records of their own, and each person who takes a task is a ChecklistClaim. The component, its responsibilities and its boundaries do not change.

Words used below. The *organising team* of an event is its organisers (contract C13: the coordinators of its group, or the super admins for a community event, plus parents whose role is marked organiser) together with everyone who may manage the event (U10's BR100.1). A *manager* is only the second part.

## Entity Model

```yaml
entities:
  - name: ChecklistTemplate
    description: A reusable task list, such as the big cleaning, the ship repair or a festival. Either a community template or a working group's template.
    owner: Checklists
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup, note: "empty means a community template, managed by super admins (Q5)" }
      - { name: name, type: text, required: true, min: 1, max: 200 }
      - { name: description, type: text, required: false, max: 1000 }
      - { name: defaultLeadDays, type: integer, required: false, min: 1, max: 60, note: "pre-fills the event form's notice lead time when this template is chosen; 14 for the big cleaning (Q6)" }
      - { name: isRemoved, type: boolean, required: true, default: false, note: "removed means hidden from new events and restorable (FR12.7, A4)" }
      - { name: removedAt, type: timestamp, required: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A group template belongs to one working group of the same community; a community template to none.
      - The name is unique, ignoring case and outer spaces, among the templates of the same owner (the community, or one working group), removed ones included, so a restored template never clashes.
      - removedAt is set exactly when isRemoved is true.
      - At most 30 sections and 300 tasks per template.
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: ChecklistTemplate to WorkingGroup, note: optional }
      - { to: TemplateSection, cardinality: one-to-many, direction: TemplateSection to ChecklistTemplate }

  - name: TemplateSection
    description: A heading in a template, such as an area of the big cleaning, with the kind of people it is for.
    owner: Checklists
    change: new; components.md held the section as a text on the task
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: templateId, type: reference, required: true, references: ChecklistTemplate }
      - { name: position, type: integer, required: true, min: 1, max: 30 }
      - { name: title, type: text, required: true, min: 1, max: 100 }
      - { name: kind, type: enum, required: true, allowed: [parents, organisers, teachers], default: parents, note: "Szülők, Szervezők, Óvónők (Q4)" }
    constraints:
      - Positions run 1 to the count within a template, each once.
    relationships:
      - { to: ChecklistTemplate, cardinality: many-to-one, direction: TemplateSection to ChecklistTemplate }
      - { to: TemplateTask, cardinality: one-to-many, direction: TemplateTask to TemplateSection }

  - name: TemplateTask
    description: One task of a template section, with the optional fields an event task copies.
    owner: Checklists
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: sectionId, type: reference, required: true, references: TemplateSection }
      - { name: position, type: integer, required: true, min: 1, max: 300 }
      - { name: title, type: text, required: true, min: 1, max: 200 }
      - { name: place, type: text, required: false, max: 200 }
      - { name: props, type: text, required: false, max: 300, note: "what to bring or use, such as the props of a game station" }
      - { name: priority, type: integer, required: false, min: 1, max: 3 }
      - { name: materials, type: text, required: false, max: 300, note: "tools and materials" }
      - { name: tip, type: text, required: false, max: 1000, note: "such as never using the big ladder alone (AC12.1.4)" }
      - { name: summerOnly, type: boolean, required: true, default: false, note: "copied only into a summer event (FR12.6)" }
      - { name: helpersNeeded, type: integer, required: true, min: 1, max: 20, default: 1, note: "how many people may take the task (Q2)" }
      - { name: timeMatters, type: boolean, required: true, default: false, note: "a claim then offers a date and time (FR11.11)" }
    constraints:
      - Positions run 1 to the count within a section, each once.
      - A task in a teachers' section keeps helpersNeeded 1 and timeMatters false, because nobody claims it (Q4).
      - A template task has no deadline; a deadline is a date and belongs to the event task (FR12.3).
    relationships:
      - { to: TemplateSection, cardinality: many-to-one, direction: TemplateTask to TemplateSection }

  - name: EventChecklist
    description: The head record of one event's checklist. It carries the checklist's own version, so reordering and structural changes are checked without touching U10's event row.
    owner: Checklists
    change: new; added after the design review, so this unit never needs the event's version
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, unique: true, references: Event }
      - { name: copiedFromTemplateId, type: reference, required: false, references: ChecklistTemplate, note: "information only; no live link (ADR-005). Kept when the template is removed" }
      - { name: version, type: integer, required: true, min: 1, default: 1, note: "goes up on every reorder, every section added or removed and every task added or removed" }
    constraints:
      - One per event, created by the first command that gives the event a section (the copy, a manager's first section, or C15).
      - The checklist is empty while it has no section; an event with no head record also counts as empty.
    relationships:
      - { to: Event, cardinality: one-to-one, direction: EventChecklist to Event }
      - { to: EventChecklistSection, cardinality: one-to-many, direction: EventChecklistSection to EventChecklist }

  - name: EventChecklistSection
    description: A section of one event's own checklist, copied from a template or added on the event.
    owner: Checklists
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: checklistId, type: reference, required: true, references: EventChecklist }
      - { name: eventId, type: reference, required: true, references: Event, note: "the same event as the checklist's, kept for reads" }
      - { name: position, type: integer, required: true, min: 1, max: 30 }
      - { name: title, type: text, required: true, min: 1, max: 100 }
      - { name: kind, type: enum, required: true, allowed: [parents, organisers, teachers], default: parents }
      - { name: version, type: integer, required: true, min: 1, default: 1, note: "a change of title or kind sends it" }
    constraints:
      - Positions run 1 to the count within an event, each once.
      - At most 30 sections and 300 tasks per event.
      - The kind of a section cannot change while one of its tasks has a claim or a done mark (BR164.3).
    relationships:
      - { to: EventChecklist, cardinality: many-to-one, direction: EventChecklistSection to EventChecklist }
      - { to: Event, cardinality: many-to-one, direction: EventChecklistSection to Event }
      - { to: EventChecklistTask, cardinality: one-to-many, direction: EventChecklistTask to EventChecklistSection }

  - name: EventChecklistTask
    description: One task of an event's checklist, with its own copy of the template fields, an optional deadline and the done mark.
    owner: Checklists
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: sectionId, type: reference, required: true, references: EventChecklistSection }
      - { name: position, type: integer, required: true, min: 1, max: 300 }
      - { name: title, type: text, required: true, min: 1, max: 200 }
      - { name: place, type: text, required: false, max: 200 }
      - { name: props, type: text, required: false, max: 300 }
      - { name: priority, type: integer, required: false, min: 1, max: 3 }
      - { name: materials, type: text, required: false, max: 300 }
      - { name: tip, type: text, required: false, max: 1000 }
      - { name: deadline, type: date, required: false, constraints: [not after the date of the event's endsAt], note: "by when, as on the ship repair list (FR12.3)" }
      - { name: summerOnly, type: boolean, required: true, default: false, note: "kept so the task shows its Nyáron tag" }
      - { name: helpersNeeded, type: integer, required: true, min: 1, max: 20, default: 1 }
      - { name: timeMatters, type: boolean, required: true, default: false }
      - { name: sourceRef, type: text, required: false, max: 100, note: "set by contract C15 (for example a to-do task); the same sourceRef on the same event returns the existing task" }
      - { name: doneAt, type: timestamp, required: false }
      - { name: doneByParentId, type: reference, required: false, references: Parent, note: "who marked it done; cleared on removal (BR170.4) and then shows korábbi tag through C6" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - The task's section belongs to the same event.
      - doneAt is set when the task is done; doneByParentId is set with it and may later be cleared by removal only.
      - sourceRef is unique within an event when set.
      - Tasks in a teachers' section are never done and have no claims.
    relationships:
      - { to: Event, cardinality: many-to-one, direction: EventChecklistTask to Event }
      - { to: EventChecklistSection, cardinality: many-to-one, direction: EventChecklistTask to EventChecklistSection }
      - { to: ChecklistClaim, cardinality: one-to-many, direction: ChecklistClaim to EventChecklistTask }
      - { to: Parent, cardinality: many-to-one, direction: EventChecklistTask to Parent, note: "doneByParentId, optional" }

  - name: ChecklistClaim
    description: One person taking an event task: a parent with an account, or a typed name an organiser entered for someone without one. Counts towards nothing (FR11.12).
    owner: Checklists
    change: new; replaces the single claimedBy of components.md (Q2)
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: taskId, type: reference, required: true, references: EventChecklistTask }
      - { name: parentId, type: reference, required: false, references: Parent, note: "the parent who took the task; empty for a typed name or after removal" }
      - { name: familyId, type: reference, required: false, references: Family, note: "the parent's family when claiming, shown beside the name; empty for a typed name or after removal" }
      - { name: typedName, type: text, required: false, max: 200, note: "a helper without an account, typed by the organising team (FR11.10)" }
      - { name: note, type: text, required: false, max: 500, note: "for example how many rag rugs the family took home (FR13.6)" }
      - { name: chosenAt, type: timestamp, required: false, constraints: [only when the task's timeMatters is true, within startsAt and endsAt of the event when saved], note: "kept if the event's dates change later; a time outside the new dates is shown as such (BR165.3)" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - Exactly one of parentId and typedName is set when the claim is saved; removal may clear parentId and familyId on a kept claim, which then shows korábbi tag.
      - A parent holds at most one claim per task.
      - The claims of a task never exceed its helpersNeeded.
      - Not a duty and not a place; no rota, fair-share, standing or duty-reminder function reads it.
    relationships:
      - { to: EventChecklistTask, cardinality: many-to-one, direction: ChecklistClaim to EventChecklistTask }
      - { to: Parent, cardinality: many-to-one, direction: ChecklistClaim to Parent, note: optional }
      - { to: Family, cardinality: many-to-one, direction: ChecklistClaim to Family, note: optional }

  - name: Event
    description: U10's event. Read by this unit through contract C13 and its own reads; no field is added and this unit never writes the event row.
    owner: Events
    change: none. noticeLeadDays (pre-filled from a template's defaultLeadDays on the form), signupDeadline and isSummer are U10's fields that this unit reads
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
    constraints:
      - A cancelled or finished event's checklist is read-only, except that a parent may still give up their own claim on a task that is not done (BR165.4).
      - U10's cancellation and change notices also reach the parents holding a claim, through checklist_claimant_ids (BR170.6).
    relationships:
      - { to: EventChecklist, cardinality: one-to-one, direction: EventChecklist to Event }
      - { to: EventChecklistSection, cardinality: one-to-many, direction: EventChecklistSection to Event }
      - { to: EventChecklistTask, cardinality: one-to-many, direction: EventChecklistTask to Event }

  - name: DutyTask
    description: Today's task row (a duty). This unit stops new links from a duty to an event (Q1).
    owner: Duties
    change: task_save refuses an event link on a new or changed task (BR169.1); the eventId column stays for the rows that exist
    attributes:
      - { name: eventId, type: reference, required: false, references: Event, note: "no longer set by any command" }
    constraints:
      - A task not linked to an event works exactly as before.
    relationships: []

  - name: NoticeKind
    description: Registered kinds of notice (U5). This unit adds two, both with U10's target type event.
    owner: Notifications
    change: two registered values, added by this unit's migration (contract C8, new_values)
    attributes:
      - { name: kind, type: text, required: true, unique: true, allowed_added: [event_lead_time, checklist_unclaimed] }
    constraints:
      - 'Hungarian title prefixes are "Közeleg:" and "Gazdátlan feladatok:", followed by the event title.'
      - The notice opens /szulo/esemenyek/[id] through U10's facts function; it never names who took or left a task (NFR10).
    relationships: []

  - name: TimedCheck
    description: Registered daily checks (U5's registry). This unit adds two rows.
    owner: TimedChecks
    change: two registry rows, added by this unit's migration (contract C9)
    attributes:
      - { name: checkName, type: text, required: true, unique: true, allowed_added: [event_lead_notice, checklist_unclaimed_alert] }
    constraints:
      - Both run daily, with lock step 4 like the other checks, and are safe to run twice.
    relationships: []
```

## Summary

- **ChecklistTemplate**, **TemplateSection** and **TemplateTask** are the reusable list. A template is a community or a group template, can be hidden and restored, and pre-fills the event's lead time. Each section is for parents, organisers or teachers.
- **EventChecklist** is the head of an event's checklist and carries its own version, so reordering never needs U10's event version. **EventChecklistSection** and **EventChecklistTask** are an event's own copy (ADR-005), each with its own version. The copy keeps no live link, so a template change or removal never reaches an event. A task holds a deadline, its number of helpers, whether the time matters, and the done mark.
- **ChecklistClaim** is one helper on a task: a parent, or a typed name for someone without an account, with an optional note and chosen time.
- The event row is not touched; this unit reads it through U10's three functions and its own reads. Today's duty rows lose only the event link (Q1).
- Two notice kinds and two daily checks are registered; nothing in U5 is edited for them. U10's cancellation and change notice reads one internal function of this unit to reach the helpers (BR170.6).
- The starting templates ship with the database as an install function, not as test data (BR162.1).
