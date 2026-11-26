# Entities: u14-removal-and-anonymisation

The data shape for removing a parent, removing a family, and later deleting or anonymising a family that left. Built from `unit-of-work.md` (U14), `unit-of-work-story-map.md` (US3.6, shared with U3), `stories.md` (AC3.6.2, AC3.6.5 to AC3.6.7), `requirements.md` (FR3.7, NFR1, NFR11), `components.md` (Lifecycle, WebApplication), `contract-summary.md` (C1, C6, C16 and the deltas of U6, U10, U12, U13) and the owner's answers Q1 to Q8 in `functional-design-questions.md`. Contains no names or contact details.

Lifecycle owns no stored records of its own (`components.md`: "entities: none"). It runs the removal steps that every other component provides (contract C16) and changes a few fields of records owned by Community and Duties. The new shapes below are value objects: they exist only inside one command or read and are never stored. Every result reaches the screen as counts, codes, ids, duty titles and dates, and group names, never a person's name or contact details.

## Entity Model

```yaml
entities:
  # --- Value objects of this unit (never stored) ------------------------------------------------
  - name: RemovalSubject
    description: Who is being removed. A parent on their own, or a whole family with every parent and child in it.
    owner: Lifecycle
    change: new
    kind: value object
    attributes:
      - { name: kind, type: enum, required: true, allowed: [parent, family] }
      - { name: id, type: reference, required: true, references: "Parent or Family, by kind" }
      - { name: familyId, type: reference, required: true, references: Family, note: "for a parent, the parent's family; the family row is always locked first (C16)" }
    constraints:
      - "A parent subject must be an active parent of an active family with at least one other active parent (Q1)"
      - "A family subject must be an active family for removal, or an archived one for the later delete or anonymise"

  - name: RemovalStep
    description: One component's removal step (C16), named by its block. The order of the steps is fixed (BR201.2).
    owner: Lifecycle
    change: new
    kind: value object
    attributes:
      - { name: block, type: enum, required: true, allowed: [rota_planning, dutychanges, duties, checklists, todo, library, events, recurring_duties, notifications, working_groups, directory] }
      - { name: providedBy, type: enum, required: true, allowed: [U6, U7, U14, U11, U12, U13, U10, U9, U5, U4, U3], note: "duties is the U2 step of C16, which U2 did not build; U14 adds it (BR202.1)" }
      - { name: toClear, type: integer, required: true, min: 0, note: "links to the subject that the step empties or rows it ends" }
      - { name: toFlag, type: integer, required: true, min: 0, note: "items the step leaves for an administrator" }

  - name: RemovalPreview
    description: What a removal would do, counted without changing anything. Shown on the confirmation screen (Q6).
    owner: Lifecycle
    change: new
    kind: value object
    attributes:
      - { name: subject, type: RemovalSubject, required: true }
      - { name: subjectVersion, type: integer, required: true, note: "the parent's or family's version the confirmation screen sends back (BR200.3)" }
      - { name: steps, type: "list of RemovalStep", required: true, note: "one entry per block, in the fixed order, zeros included" }
      - { name: totals, type: "{ toClear: integer, toFlag: integer }", required: true }
      - { name: groupsLeftWithoutCoordinator, type: "list of { groupId, groupName }", required: true, note: "groups where a removed parent holds the only unrevoked coordinator role (Q2); empty when none" }
      - { name: refusal, type: enum, required: false, allowed: [PARENT_LAST_IN_FAMILY, VERSION_CONFLICT], note: "set when the removal would be refused, so the screen shows the refusal instead of the button" }

  - name: RemovalReport
    description: What a removal did. Returned by the removal command and written, as counts only, into its audit row.
    owner: Lifecycle
    change: new
    kind: value object
    attributes:
      - { name: subject, type: RemovalSubject, required: true }
      - { name: steps, type: "list of RemovalStep", required: true, note: "the counts the apply calls returned" }
      - { name: endedAccountIds, type: "list of identifier", required: true, note: "accounts whose sign-in ended, so the server can end their sessions (as U3's parent_remove does today)" }
      - { name: groupsLeftWithoutCoordinator, type: "list of { groupId, groupName }", required: true }
      - { name: auditEventId, type: identifier, required: true }

  - name: FlaggedItem
    description: One thing left for an administrator after a removal (Q6), read live from the area that owns the flag, so it disappears from the list once handled.
    owner: Lifecycle
    change: new
    kind: value object (read model)
    attributes:
      - { name: kind, type: enum, required: true, allowed: [future_place, held_book, claimed_task, family_task, family_schedule] }
      - { name: itemId, type: identifier, required: true, note: "the duty, loan, to-do task or schedule id" }
      - { name: label, type: text, required: true, note: "a duty or task title, or the book's title; no person's name" }
      - { name: onDate, type: date, required: false, note: "for a future place, the date of the duty" }
      - { name: link, type: text, required: true, note: "where the item is handled: the flagged-duties list, the library, the to-do list or the recurring duties page" }
    constraints:
      - "Read only for a super admin and only for a removed family or a removed parent's family (BR205.2)"

  - name: LifecycleOutcome
    description: The result of the later delete or anonymise of a family that left.
    owner: Lifecycle
    change: changed
    kind: value object
    attributes:
      - { name: outcome, type: enum, required: true, allowed: [deleted, anonymized] }
      - { name: steps, type: "list of RemovalStep", required: true, note: "the steps run again before the decision (Q8)" }
      - { name: auditEventId, type: identifier, required: true }

  # --- Stored records of other components that this unit changes -----------------------------
  - name: Family
    description: Owned by Community. Lifecycle changes how its removal and its later delete or anonymise work.
    owner: Community
    change: changed
    attributes:
      - { name: status, type: enum, required: true, allowed: [active, archived], note: "archived = removed. Unchanged values; removal now goes through every step (BR201.1)" }
      - { name: archivedAt, type: timestamp, required: false, note: "starts the 30-day wait (unchanged)" }
      - { name: anonymizedAt, type: timestamp, required: false, note: "set by anonymise (unchanged)" }
      - { name: displayName, type: text, required: true, note: "kept while archived for the super admin's archive and data-lifecycle screens; replaced by 'Anonimizált család' on anonymise; shown to everyone else as 'korábbi család' from removal on (BR204.1)" }
      - { name: version, type: integer, required: true }

  - name: Parent
    description: Owned by Community. A removed parent keeps an archived row so history can point at it.
    owner: Community
    change: changed
    attributes:
      - { name: status, type: enum, required: true, allowed: [active, archived], note: "archived = removed; now read as removed by the name helper (BR204.1)" }
      - { name: displayName, type: text, required: true, note: "kept on the archived row until the family is deleted or anonymised; shown to nobody but a super admin on the family record; 'Anonimizált szülő' after anonymise" }
      - { name: accountId, type: reference, required: false, references: Account, note: "cleared at removal by the directory step (unchanged)" }

  - name: FamilyYearStanding
    description: Owned by Community (U6). The leaving or new mark of a family for a school year.
    owner: Community
    change: changed
    attributes:
      - { name: familyId, type: reference, required: true, references: Family }
    constraints:
      - "Deleted when the family is deleted or anonymised (Q4, BR206.3); kept while the family is only archived, so a restore finds it"

  - name: Place
    description: Owned by Duties (an assignment of a family to a duty). Lifecycle decides what removal does to a family's future places (Q3).
    owner: Duties
    change: changed
    attributes:
      - { name: familyId, type: reference, required: true, references: Family }
      - { name: status, type: enum, required: true, note: "a future place of a manual duty becomes removed at family removal, as today; any other future place keeps its status (BR202.1)" }
      - { name: doneBy, type: reference, required: false, references: Parent, note: "kept, not cleared (BR202.2); a removed parent reads 'korábbi tag' through C6" }
```

## Summary

- **Six value objects, no new table.** `RemovalSubject`, `RemovalStep`, `RemovalPreview`, `RemovalReport`, `FlaggedItem` and `LifecycleOutcome` live only inside one command or read. The audit row of each removal holds the step counts and nothing else.
- **Eleven steps, one of them new.** Ten components already provide a removal step. The duties step, which contract C16 gave to U2 and U2 never built, is added by this unit (BR202.1).
- **Records of other components.** `Family`, `Parent`, `FamilyYearStanding` and `Place` keep their shape. What changes is which rows a removal or a delete touches, and how the name helpers read an archived parent or family (BR204.1).
- **What stays.** A removed parent's archived row and a removed family's row stay until the family is deleted or anonymised, so history keeps its links. Every screen except the super admin's family record, archive and data-lifecycle screens shows them as "korábbi tag" and "korábbi család".
