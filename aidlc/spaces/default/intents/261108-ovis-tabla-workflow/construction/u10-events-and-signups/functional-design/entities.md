# Entities: u10-events-and-signups

The data shape for events, their notices and roles, the event-wide sign-up with a note, and food offers. Built from `unit-of-work.md` (U10), `unit-of-work-story-map.md`, `stories.md` (US11.1 to US11.4 and the event part of US17.1), `requirements.md` (FR1.2, FR1.3, FR1.6, FR2.3, FR4.4, FR11, FR17.4, NFR3 to NFR5, NFR10), `components.md` (Events, Duties, WebApplication), `contract-summary.md` (C1, C2, C6 to C8, C10, C13, C14, C16, C18) and the owner's answers Q1 to Q6 in `functional-design-questions.md`. Decisions are ADR-001, ADR-002, ADR-003 and ADR-010 in `decisions.md`. Contains no names or contact details.

Only what this unit adds or changes is listed. Working groups, parents, families and the notice records keep the shape U1, U3, U4 and U5 gave them. As before, a *duty* and a *place* are the rows today's code calls a task and an assignment. Today's event tasks (a task with an event, with places, notes and swaps) are kept as they are (Q6, BR121); only the event itself changes here.

## Entity Model

```yaml
entities:
  - name: Event
    description: A community or working-group occasion with a start and an end, which may last several weeks. Today's event row, extended.
    owner: Events
    change: gains isSummer, signupDeadline, noticeLeadDays, foodSignupOn and tale; loses the three fixed notes (allergen, supply, food) and the typed coordinator name; group stays optional (U1)
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup, note: "empty means a community event (ADR-001)" }
      - { name: title, type: text, required: true, min: 1, max: 200 }
      - { name: location, type: text, required: false, max: 200 }
      - { name: startsAt, type: timestamp, required: true }
      - { name: endsAt, type: timestamp, required: true, constraints: [not before startsAt] }
      - { name: status, type: enum, required: true, allowed: [planned, cancelled], default: planned }
      - { name: isSummer, type: boolean, required: true, default: false, note: "read by U11 through event_is_summer (C13); stored here because U10 owns the event" }
      - { name: signupDeadline, type: date, required: false, constraints: [not after the date of endsAt], note: "shown to parents; read by U11 through event_deadline (C13). Nothing is refused after it (BR108.4)" }
      - { name: noticeLeadDays, type: integer, required: false, min: 1, max: 60, note: "days before startsAt for the lead-time notice sent by U11; empty means none" }
      - { name: foodSignupOn, type: boolean, required: true, default: false }
      - { name: tale, type: text, required: false, max: 5000, note: "the year's tale; stays with the event" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A working-group event belongs to one active working group of the same community; a community event to none (U1, BR2).
      - A task of the event has the event's scope (U1).
      - The group of an event cannot change while the event has tasks (today's rule, kept).
      - Cancelling closes the event's open tasks; setting the status back to planned does not reopen them (today's behaviour, kept).
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: Event to WorkingGroup, note: optional }
      - { to: EventNotice, cardinality: one-to-many, direction: EventNotice to Event }
      - { to: EventRole, cardinality: one-to-many, direction: EventRole to Event }
      - { to: EventSignup, cardinality: one-to-many, direction: EventSignup to Event }
      - { to: FoodOffer, cardinality: one-to-many, direction: FoodOffer to Event }
      - { to: DutyTask, cardinality: one-to-many, direction: DutyTask to Event, note: "today's event tasks, kept (BR121.1)" }

  - name: EventNotice
    description: One line shown at the top of an event, such as "bring your own cup and plate" or an allergen notice.
    owner: Events
    change: new; replaces the three fixed notes of an event (Q5)
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: position, type: integer, required: true, min: 1, max: 10 }
      - { name: text, type: text, required: true, min: 1, max: 300 }
    constraints:
      - At most 10 notices per event, positions 1 up to the count with no gap, each position once.
      - The list is saved as a whole with the event's version (BR103.2).
    relationships:
      - { to: Event, cardinality: many-to-one, direction: EventNotice to Event }

  - name: EventRole
    description: A named role on an event, such as game master, held by one person. The person is either a parent with an account, chosen from the directory, or a typed name for someone with no account.
    owner: Events
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: name, type: text, required: true, min: 1, max: 100, note: "the role, for example game master" }
      - { name: parentId, type: reference, required: false, references: Parent, note: "a parent with an active account; shown through C6, so a removed parent shows as korábbi tag" }
      - { name: personName, type: text, required: false, max: 200, note: "a typed name, for a person with no account; shown as typed, with no link and no profile" }
      - { name: isOrganiser, type: boolean, required: true, default: false, note: "only with parentId (Q4); makes that parent an organiser of the event for contract C13, with no right to edit" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - Exactly one of parentId and personName is set when the role is saved; a removal (BR124) may clear it to neither, and the role then shows as korábbi tag.
      - isOrganiser is true only when parentId is set.
      - At most 20 roles per event.
    relationships:
      - { to: Event, cardinality: many-to-one, direction: EventRole to Event }
      - { to: Parent, cardinality: many-to-one, direction: EventRole to Parent, note: optional }

  - name: EventSignup
    description: One parent's offer to help at an event, with a note and an optional date and time. It counts as the parent's family's and counts towards nothing (FR11.12).
    owner: Events
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: parentId, type: reference, required: false, references: Parent, note: "empty once the parent was removed (BR124.1)" }
      - { name: familyId, type: reference, required: false, references: Family, note: "the parent's family when signing up; empty once removed" }
      - { name: note, type: text, required: false, max: 500 }
      - { name: chosenAt, type: timestamp, required: false, constraints: [within startsAt and endsAt of the event] }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A parent may hold several sign-ups on one event, at most 10 (Q1, BR109.2).
      - Not a duty and not a place: no rota, fair-share, standing or reminder function reads it (BR111.1).
    relationships:
      - { to: Event, cardinality: many-to-one, direction: EventSignup to Event }
      - { to: Parent, cardinality: many-to-one, direction: EventSignup to Parent, note: optional }
      - { to: Family, cardinality: many-to-one, direction: EventSignup to Family, note: optional }

  - name: FoodOffer
    description: One dish a parent offers for an event, in one of eight categories, with tick boxes for milk, egg and garlic that describe the dish's ingredients only.
    owner: Events
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: eventId, type: reference, required: true, references: Event }
      - { name: parentId, type: reference, required: false, references: Parent, note: "empty once the parent was removed (BR124.1)" }
      - { name: category, type: enum, required: true, allowed: [spreads, bread, free_from, savoury, sweet, drinks, vegetables_fruit, other] }
      - { name: text, type: text, required: true, min: 1, max: 200, note: what the dish is }
      - { name: hasMilk, type: boolean, required: true, default: false }
      - { name: hasEgg, type: boolean, required: true, default: false }
      - { name: hasGarlic, type: boolean, required: true, default: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - Offers can be added only while the event's foodSignupOn is true.
      - A parent may make several offers on one event, at most 20 (BR113.3).
      - The three ticks are the only allergen data; no field links a dish to a child, a family's health or a diet (BR115.1).
    relationships:
      - { to: Event, cardinality: many-to-one, direction: FoodOffer to Event }
      - { to: Parent, cardinality: many-to-one, direction: FoodOffer to Parent, note: optional }

  - name: NoticeKind
    description: Registered kinds of notice (U5). This unit adds three.
    owner: Notifications
    change: three registered values, added by this unit's migration (contract C8, new_values)
    attributes:
      - { name: kind, type: text, required: true, unique: true, allowed_added: [event_new, event_cancelled, event_changed] }
    constraints:
      - 'Hungarian title prefixes are "Új esemény", "Esemény elmarad" and "Esemény módosult".'
    relationships: []

  - name: NoticeTarget
    description: Registered kinds of item a notice concerns (U5). This unit registers event.
    owner: Notifications
    change: one registered value, with its facts function (title, date, page path /szulo/esemenyek/[id])
    attributes:
      - { name: targetType, type: text, required: true, unique: true, allowed_added: [event] }
    constraints:
      - The facts function returns only the event's title, dates and place; never a sign-up, an offer or a contact detail (NFR10).
    relationships: []
```

## Summary

- **Event** is today's event row with five new fields and a free list of notices in place of the three fixed notes. Community and group events are one model (the bolt's proof): the group is simply optional.
- **EventNotice** is the ordered list shown at the top; **EventRole** is a role held by an account holder or a typed name, and may mark an account holder as organiser; **EventSignup** is the event-wide "I'll help" with a note and optional time; **FoodOffer** is a dish with three ingredient ticks.
- No event record joins a child or a family's health. The sign-up and offer link only to the parent who made them, and that link is cleared on removal (BR124).
- Three notice kinds and one target type are registered for U5's notice function; nothing in U5 is edited.
