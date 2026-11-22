# Entities: u7-swaps-and-duty-changes

The data shape for swaps, cancellations and an administrator's changes to a duty already given out. Built from `unit-of-work.md` (U7), `unit-of-work-story-map.md` (US5.4, US8.2, US8.3), `stories.md`, `requirements.md` (FR4.4, FR5.4, FR8.2 to FR8.5, NFR4, assumption A6), `components.md` (DutyChanges, Duties, RotaPlanning, TimedChecks, WebApplication), `contract-summary.md` (C1, C5, C8, C9, C10, C11, C16, C19) and the owner's answers Q1 to Q4 in `functional-design-questions.md`. Decisions are ADR-004 and ADR-011 in `decisions.md`. Contains no names or contact details.

In the database a *duty* is a task row and a *place* is an assignment row, as in U2 and U6. The one entity of this unit, ChangeRequest, already exists as the `change_requests` table from the earlier swap work; this unit widens it rather than adding a second table. A *rota duty* is a duty whose origin is `rota_week` or `weekend_slot` (U6).

## Entity Model

```yaml
entities:
  - name: ChangeRequest
    description: A family's request to swap one of its places with another family's place, or to cancel one of its places. A swap applies as soon as the other family accepts; a cancellation waits for an administrator. The request is kept as history after it ends.
    owner: DutyChanges
    change: changed
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: kind, type: enum, required: true, allowed: [swap, cancellation] }
      - { name: sourcePlaceId, type: reference, required: true, references: Place, note: "the requesting family's place" }
      - { name: targetPlaceId, type: reference, required: false, references: Place, note: "the other family's place; swaps only" }
      - { name: sourceFamilyId, type: reference, required: true, references: Family, note: "new; the family that asked, kept so the request still names a family after the places change hands" }
      - { name: targetFamilyId, type: reference, required: false, references: Family, note: "new; the other family of a swap" }
      - { name: requestedByParentId, type: reference, required: false, references: Parent, note: "the requester (stored today as requested_by_parent_id; this settles the C16 open question). Cleared when the parent is removed and the request has ended (BR77.3)" }
      - { name: sourceDutyId, type: reference, required: true, references: Duty }
      - { name: targetDutyId, type: reference, required: false, references: Duty }
      - { name: sourceVersion, type: integer, required: true, note: "the source place's version right after the request marked it pending; an acceptance or decision compares the place against it (BR71.5, BR72.1)" }
      - { name: targetVersion, type: integer, required: false, note: "the same for the target place" }
      - { name: appliedSourceVersion, type: integer, required: false, note: "new; the source place's version at the end of the transaction that applied the swap, after the places returned to active and C11 ran; read by a reversal (BR72.2, BR75.2)" }
      - { name: appliedTargetVersion, type: integer, required: false, note: "new; the same for the target place" }
      - { name: reason, type: text, required: false, max: 500, note: "shown to the other family and to administrators only (FR8.5, AC8.3.1, AC8.3.2)" }
      - { name: status, type: enum, required: true, allowed: [open, applied, rejected, withdrawn, expired, cancelled, approved, reversed], default: open, note: "expired, cancelled and reversed are new; see the state machine in functional-spec.md" }
      - { name: endedReason, type: enum, required: false, allowed: [declined, withdrawn_by_requester, earlier_duty_started, duty_started, duty_reassigned, family_removed, administrator_rejected], note: "new; why a request that did not apply ended, so each notice can say it" }
      - { name: decidedByAccountId, type: reference, required: false, references: Account, note: "who decided a cancellation, reassigned a duty or reversed a swap. An account, not a parent, because a super admin may have no parent record (this settles the C16 open question). Cleared on the removal of that person (BR77.3)" }
      - { name: decidedAt, type: timestamp, required: false }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A swap names a target place, a target duty, a target family and a target version; a cancellation names none of them.
      - A place is in at most one open request, as source or as target (AC8.2.8). This is guaranteed by the place locks and the rule that only an active place can enter a request (BR71.3); today's source-side partial index stays as a backstop.
      - approved is used only by a cancellation; applied and reversed only by a swap; expired by both (BR73.1, BR73.2).
      - A request that is not open never changes again, except a swap going from applied to reversed and the clearing of person fields on removal.
      - appliedSourceVersion and appliedTargetVersion are set exactly when a swap is applied.
    relationships:
      - { to: Place, cardinality: many-to-one, direction: ChangeRequest to Place, note: "the source place, and for a swap the target place" }
      - { to: Duty, cardinality: many-to-one, direction: ChangeRequest to Duty }
      - { to: Family, cardinality: many-to-one, direction: ChangeRequest to Family, note: "source family, and target family for a swap" }
      - { to: Parent, cardinality: many-to-one, direction: ChangeRequest to Parent, note: "optional; the requester" }

  - name: Place
    description: Owned by Duties (U2). Listed here only for what this unit changes.
    owner: Duties
    change: changed
    attributes:
      - { name: status, type: enum, required: true, allowed: [active, swap_pending, cancellation_pending, removed], note: "unchanged list. A swap's target place now also shows swap_pending, so the other family sees it is asked" }
    constraints:
      - Who holds a place changes only through the C5 functions, called from the DutyChanges block.

  - name: RotaWeek
    description: Owned by RotaPlanning (U6). Listed here only for what this unit changes.
    owner: RotaPlanning
    change: changed
    attributes:
      - { name: emptyReason, type: enum, required: false, allowed_add: [cancelled], note: "new value for a week whose duty an administrator cancelled (Q3); the week is flagged like a week whose family was removed" }

  - name: NoticeKind
    description: Owned by Notifications (U5). The kinds this unit registers for its notices (C8).
    owner: Notifications
    change: changed
    attributes:
      - { name: kind, type: enum, allowed_keep: [swap_requested, swap_decided, cancellation_decided], allowed_add: [swap_withdrawn, swap_expired, swap_cancelled, swap_reversed, duty_reassigned], note: "swap_decided now covers accepted and declined; the asked-to-pick notice is U6's existing one" }

  - name: AuditAction
    description: Owned by Platform. The actions this unit adds to the audit list (NFR4).
    owner: Platform
    change: changed
    attributes:
      - { name: action, type: enum, allowed_keep: [approval.approve, approval.reject], allowed_add: [swap.reversed, duty.reassigned], note: "a swap the families agree on is not an administrator intervention and is not audited; its request row is its record" }
```

## Summary

| Entity | Change | What this unit does with it |
|---|---|---|
| ChangeRequest | changed | Swaps across any kind of duty, applied on acceptance; cancellations decided by an administrator; new statuses expired, cancelled and reversed; the families and the versions after applying are kept for reversal and history |
| Place | changed | A swap's target place is marked swap_pending as well; holders change only through C5 |
| RotaWeek | changed | New empty reason `cancelled` after an approved cancellation (Q3) |
| NoticeKind | changed | Five new notice kinds |
| AuditAction | changed | `swap.reversed` and `duty.reassigned` |

A swap moves families between two places; nothing is copied. A weekend opening, closing or shelter cleaning is never the source or target of a swap (Q2); it moves only with its week, through C11.
