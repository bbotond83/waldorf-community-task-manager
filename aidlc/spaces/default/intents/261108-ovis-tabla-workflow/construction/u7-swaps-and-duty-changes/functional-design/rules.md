# Business Rules: u7-swaps-and-duty-changes

Built from `unit-of-work.md` (U7), `unit-of-work-story-map.md`, `stories.md` (US5.4, US8.2, US8.3), `requirements.md` (FR4.4, FR5.4, FR8.2 to FR8.5, NFR4, assumption A6), `components.md` (DutyChanges), `contract-summary.md` (C1, C5, C8, C9, C10, C11, C16, C19), `decisions.md` (ADR-004, ADR-011) and `functional-design-questions.md` (Q1 to Q4). Every rule is enforced on the database side; screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. The rules of U1 (BR1 to BR8) about reach, U2's place rules and U6's changeover and same-week rules still hold. Contains no names or contact details.

All times are Budapest time. A duty *starts* at its start time; a rota week starts on its Monday at 00:00 (U6). A place is *future* while its duty has not started. A *rota duty* has origin `rota_week` or `weekend_slot`. A *weekend slot place* is a place on a duty of origin `weekend_slot` (an opening, a closing or the shelter cleaning).

## Rules

```yaml
rules:
  # --- Who may do what -------------------------------------------------------------------------
  - id: BR70.1
    statement: Only a parent of the family that holds a place can ask to swap or cancel it, and only a parent of the other family can answer a swap.
    category: authorization
    applies_to: [ChangeRequest]
    trigger: swap_request, swap_respond, swap_withdraw, cancellation_request
    logic: The caller needs an active session and a current family (C1). A group admin or super admin acts here only as a parent of their own family. A teacher is refused. Proposing and withdrawing need the source family; accepting and declining need the target family. A caller who is neither gets the denied refusal and learns nothing about the request.
    violation: Denied refusal (authorization_denied).
    source: FR8.2, AC8.2.1, AC5.4.5, contract C1
  - id: BR70.2
    statement: Only a super admin reassigns a rota duty, reverses a swap or decides the cancellation of a rota duty.
    category: authorization
    applies_to: [ChangeRequest, Place]
    trigger: duty_reassign, swap_reverse, cancellation_decide
    logic: For a rota duty, the caller must have super scope in the community. A working-group admin, a parent and a teacher are refused (AC5.4.5). For a duty that is not a rota duty (a manual or event duty), the caller must reach the duty's group, as for assigning it today. A swap reversal touches two places; the caller must be allowed on both.
    violation: Denied refusal (authorization_denied).
    source: AC5.4.1, AC5.4.5, AC8.2.4, FR8.3, assumption A6
  - id: BR70.3
    statement: A request's reason is seen by the other family and by administrators, and by nobody else.
    category: authorization
    applies_to: [ChangeRequest]
    trigger: swap_incoming, swap_list, cancellation list on the approvals screen
    logic: swap_incoming returns the reason to the requesting family and, for a swap, to the target family. swap_list and the approvals screen return it to a caller allowed by BR70.2. No other read returns it. A reason that is empty is returned as nothing.
    violation: Not applicable; a read.
    source: FR8.5, AC8.3.1, AC8.3.2
  # --- Proposing a swap ------------------------------------------------------------------------
  - id: BR71.1
    statement: A family can propose to swap one of its future places with another family's future place of any kind.
    category: validation
    applies_to: [ChangeRequest, Place]
    trigger: swap_request
    logic: IF the two places are active, on two different duties, held by two different families, both duties are open and have not started, and neither family already holds a place on the other duty, THEN the proposal may go ahead. The duties may be of different kinds and of different working groups; no group membership is checked (Q1). This replaces today's same-group rule and today's refusal of rota duties (DUTY_ROTA_MANAGED), which is retired for swaps.
    violation: Conflict refusal DUTY_CLOSED for a started or closed duty, DUTY_ALREADY_ASSIGNED for the same family or a family already on the other duty, REQUEST_CONFLICT for a place that is not active.
    source: FR8.2, AC8.2.1, Q1, contract C5
  - id: BR71.2
    statement: A weekend opening, closing or shelter cleaning is never swapped on its own.
    category: constraint
    applies_to: [ChangeRequest]
    trigger: swap_request, swap_candidates
    logic: IF either place is a weekend slot place, THEN the proposal is refused, and swap_candidates never offers one. Such a place follows its week (BR72.3); a family that wants another slot changes its pick (U6).
    violation: Conflict refusal SWAP_SLOT_FOLLOWS_WEEK.
    source: Q2, AC8.2.3
  - id: BR71.3
    statement: A place is in at most one open request.
    category: constraint
    applies_to: [ChangeRequest]
    trigger: swap_request, cancellation_request
    logic: IF either place is already the source or target of an open swap or cancellation, THEN the new request is refused. The guarantee is the place locks of BR77.1 together with the status check of BR71.1 (a place must be active to enter a request, and entering one makes it swap_pending or cancellation_pending), so a second proposal at the same moment waits for the first and then finds the place no longer active. Today's partial uniqueness index on the source side stays as a backstop; no index is added for the target side, because two separate partial indexes could not stop a place being source in one request and target in another.
    violation: Conflict refusal REQUEST_DUPLICATE.
    source: AC8.2.8, AC8.2.9
  - id: BR71.4
    statement: A swap that would break the changeover rule or give a family indoor cleaning and front garden in the same week is refused when proposed and again when accepted.
    category: validation
    applies_to: [ChangeRequest]
    trigger: swap_request, swap_respond (accept)
    logic: Each family is judged with C10 family_may_hold_duty on the start date of the duty it would receive. Then C11 rota_check_change is asked with both changes together, so a swap of two weeks of the same family pair is judged as a whole. The reason the parent sees is the plain one C10 or C11 gives.
    violation: Conflict refusal DUTY_INELIGIBLE or ROTA_SAME_WEEK_CLASH, with the reason.
    source: FR4.4, FR5.4, FR8.4, AC8.2.2, contract C10, contract C11
  - id: BR71.5
    statement: The proposal stores the versions it was made on and an optional reason, and tells the other family.
    category: policy
    applies_to: [ChangeRequest]
    trigger: swap_request
    logic: The caller sends the versions of both places as its screen showed them; a mismatch is refused before anything changes. Then both places become swap_pending, which raises each place's version by one, and the request stores the versions the places have after that change (sourceVersion and targetVersion), together with both families, both duties and the reason (up to 500 characters after trimming; empty is stored as nothing). Storing the versions after the pending mark is what lets BR72.1 tell an unchanged place from a changed one. The other family gets the swap_requested notice, which carries the reason.
    violation: Invalidated refusal REQUEST_VERSION_STALE; validation refusal on a reason over 500 characters.
    source: FR8.5, AC8.3.1, AC8.2.9, contract C8
  # --- Answering a swap ------------------------------------------------------------------------
  - id: BR72.1
    statement: An acceptance applies the swap at once only if nothing changed since the proposal.
    category: constraint
    applies_to: [ChangeRequest, Place]
    trigger: swap_respond (accept)
    logic: The caller sends the request's own version as its screen showed it (an outdated screen is refused with REQUEST_VERSION_STALE). Under the locks of BR77.1, IF the request is still open, both places still have exactly the versions stored on the request (any change to a place after the proposal raised its version), both duties have not started, and BR71.1 (with the places swap_pending instead of active) and BR71.4 still pass, THEN the swap applies. Otherwise the acceptance is refused and the request stays open for the requester to withdraw or for it to expire.
    violation: Conflict refusal SWAP_REQUEST_NOT_OPEN for a request that has ended, SWAP_CANNOT_BE_APPLIED for a changed place or a broken rule, with the reason.
    source: AC8.2.1, AC8.2.9, FR8.3
  - id: BR72.2
    statement: Applying a swap changes both places, follows the rota and tells both families, in one transaction.
    category: policy
    applies_to: [ChangeRequest, Place, RotaWeek]
    trigger: swap_respond (accept), swap_reverse
    logic: In order (ADR-011) rota_check_change, then C5 place_exchange, then both places return to active, then C11 rota_adjust_picks_after_change with both changes, and last the request becomes applied with appliedSourceVersion and appliedTargetVersion read from the two places after every other step of the transaction, so the stored versions are the ones a later reversal will find if nothing touched the places since. Both families get swap_decided (accepted). If any step fails, nothing is kept. No administrator is involved and nothing is written to the audit log.
    violation: Any failing step rolls the whole swap back with that step's refusal.
    source: AC8.2.1, FR8.3, contract C5, contract C11
  - id: BR72.3
    statement: A swapped week's weekend pick moves with the duty when the slot is still valid; otherwise the new family is asked to pick.
    category: policy
    applies_to: [RotaWeek]
    trigger: swap_respond (accept), duty_reassign, swap_reverse
    logic: This is C11 rota_adjust_picks_after_change as U6 delivers it. The pick moves when the new family is not that week's weekend family and the weekend has not started. Otherwise the pick goes, the slot returns to the weekend family and the new family gets U6's asked-to-pick notice when it still owes a pick. Once that weekend's Saturday has begun, the picks stay as they are.
    violation: Not applicable; follows the change.
    source: AC8.2.3, AC5.4.3, contract C11
  - id: BR72.4
    statement: Declining ends the swap and tells the proposer.
    category: policy
    applies_to: [ChangeRequest]
    trigger: swap_respond (decline)
    logic: Only the target family declines. The request becomes rejected with endedReason declined, both places return to active, and the proposer gets swap_decided (declined). The duties stay as they were.
    violation: Conflict refusal SWAP_REQUEST_NOT_OPEN for a request that has ended.
    source: AC8.2.5
  - id: BR72.5
    statement: Withdrawing ends the swap and tells the other family.
    category: policy
    applies_to: [ChangeRequest]
    trigger: swap_withdraw
    logic: Only the source family withdraws, while the request is open. The request becomes withdrawn with endedReason withdrawn_by_requester, both places return to active, and the other family gets swap_withdrawn. A cancellation request is withdrawn the same way and tells nobody.
    violation: Conflict refusal SWAP_REQUEST_NOT_OPEN.
    source: AC8.2.6
  # --- Expiry ----------------------------------------------------------------------------------
  - id: BR73.1
    statement: A pending swap expires when the earlier of its two duties starts, and both families are told.
    category: policy
    applies_to: [ChangeRequest]
    trigger: the daily run (check swap_expiry, C9); every command on the request
    logic: The daily run marks every open swap whose earlier duty has started as expired with endedReason earlier_duty_started, returns both places to active and sends swap_expired to both families, once per request. Between the start and the next run, every command already treats such a request as expired: an acceptance is refused and the screens show it as expired. Running the check twice changes nothing more.
    violation: Conflict refusal SWAP_EXPIRED for an answer to an expired request.
    source: AC8.2.7, contract C9
  - id: BR73.2
    statement: An undecided cancellation request ends when its duty starts; the family keeps the duty and is told.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: the daily run (check swap_expiry, C9); cancellation_decide
    logic: Because a started duty cannot change (BR74.3), a cancellation nobody decided before the duty started can no longer be approved. The same daily check marks it expired with endedReason duty_started, returns the place to active, and sends the family cancellation_decided with the outcome expired. Until the run marks it, cancellation_decide answers it with CANCELLATION_EXPIRED and the approvals screen shows it as expired. The administrator is not notified separately; the approvals screen lists it among the ended requests.
    violation: Conflict refusal CANCELLATION_EXPIRED.
    source: assumption A6, AC5.4.4, contract C9
  # --- The administrator ----------------------------------------------------------------------
  - id: BR74.1
    statement: A super admin gives a future published rota duty to another family, also when the duty has nobody.
    category: policy
    applies_to: [Place, RotaWeek]
    trigger: duty_reassign
    logic: The caller names the duty, the version it saw (the place's version when the duty has a place, otherwise the duty's) and the new family, an active family of the community that does not already hold a place on that duty. IF the duty has an active place, THEN it is reassigned through C5 place_reassign. IF a rota_week duty has no active place (an approved cancellation, BR76.2, or a removed family), THEN a new place for the family is added through C5 place_add, the one new C5 function this unit delivers, and the week is filled. Either way C11 then runs as a change to the new family, so the rota week takes the family and its pick follows BR72.3. A weekend slot place is not reassigned here; an unpicked or picked opening or closing is assigned with U6's weekend_pick_assign, which keeps the pick rules (Q2).
    violation: Conflict refusal VERSION_CONFLICT, DUTY_ALREADY_ASSIGNED, or SWAP_SLOT_FOLLOWS_WEEK for a weekend slot place.
    source: AC5.4.1, FR8.3, contract C5
  - id: BR74.2
    statement: A reassignment that would break the changeover rule or the same-week rule is refused with the reason.
    category: validation
    applies_to: [Place]
    trigger: duty_reassign
    logic: The new family is judged with C10 on the duty's start date, then the change is checked with C11 rota_check_change, before anything changes.
    violation: Conflict refusal DUTY_INELIGIBLE or ROTA_SAME_WEEK_CLASH, with the reason.
    source: AC5.4.2, FR4.4, FR5.4
  - id: BR74.3
    statement: A duty that has started cannot change, by anyone.
    category: constraint
    applies_to: [Place, ChangeRequest]
    trigger: every command of this unit
    logic: IF the duty of any place the command would change has started, THEN the command is refused. This holds for proposing and accepting swaps, reversing, reassigning, cancelling and deciding a cancellation.
    violation: Conflict refusal DUTY_CLOSED.
    source: AC5.4.4, contract C5
  - id: BR74.4
    statement: Reassigning a place ends its pending swap or cancellation, and everyone concerned is told.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: duty_reassign
    logic: In the same transaction, an open swap on the place becomes cancelled with endedReason duty_reassigned and both families of the swap get swap_cancelled; an open cancellation request on it becomes cancelled and its family is told with cancellation_decided. The other place of a cancelled swap returns to active. Then the reassignment runs with BR72.3, the old and the new family get duty_reassigned, and the action is audited as duty.reassigned with the place as target and no names.
    violation: Not applicable; follows the change.
    source: AC5.4.1, AC5.4.3, AC5.4.6, NFR4
  - id: BR75.1
    statement: Administrators see every swap, pending or applied, with its reason.
    category: policy
    applies_to: [ChangeRequest]
    trigger: swap_list
    logic: A super admin sees the community's swaps; an admin allowed by BR70.2 for non-rota duties sees those of their groups. Each row shows both families through C6, both duties, the status, when it was proposed and decided, the reason, and whether it can be reversed now. Ended swaps that never applied are listed too, newest first, for the current school year.
    violation: Denied refusal for anyone else.
    source: AC8.2.4, FR8.3, AC8.3.1
  - id: BR75.2
    statement: An applied swap can be reversed only while neither place has changed since and neither duty has started.
    category: constraint
    applies_to: [ChangeRequest, Place]
    trigger: swap_reverse
    logic: IF the request is applied, both places still have the versions stored as appliedSourceVersion and appliedTargetVersion, and both duties have not started, THEN the reversal may go ahead. Otherwise it is refused with the reason, and the screen points to reassigning the duties one by one (BR74.1).
    violation: Conflict refusal SWAP_CHANGED_SINCE, or DUTY_CLOSED.
    source: AC8.2.10, AC5.4.4
  - id: BR75.3
    statement: A reversal swaps the places back with the same rules, tells both families and is audited.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: swap_reverse
    logic: The reversal runs BR71.4's checks and BR72.2's steps with the families the other way round, the request becomes reversed with decidedByAccountId and decidedAt set, both families get swap_reversed, and the action is audited as swap.reversed with the request as target and no names.
    violation: Conflict refusal DUTY_INELIGIBLE or ROTA_SAME_WEEK_CLASH, with the reason.
    source: AC8.2.4, NFR4
  - id: BR75.4
    statement: An administrator no longer approves or rejects a pending swap.
    category: policy
    applies_to: [ChangeRequest]
    trigger: swap_decide (retired)
    logic: Only the two families decide a pending swap (Q4). The approvals screen keeps cancellations only. swap_decide is removed from the granted functions, so a call is refused like any unknown function.
    violation: Not callable.
    source: Q4, FR8.3
  # --- Cancellation ----------------------------------------------------------------------------
  - id: BR76.1
    statement: A family asks to cancel one of its future places with an optional reason, and an administrator decides.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: cancellation_request
    logic: The place must be active, not in an open request (BR71.3) and its duty not started. A weekend slot place is refused (the family changes its pick instead, Q2), and an animal-care slot is given up with U8's slot_give_up (C19). The reason is stored as for a swap. The place becomes cancellation_pending and stays with the family until the decision. Today's refusal of rota duties (DUTY_ROTA_MANAGED) is retired.
    violation: Conflict refusal REQUEST_DUPLICATE, DUTY_CLOSED, SWAP_SLOT_FOLLOWS_WEEK or SLOT_NOT_RELEASABLE; invalidated REQUEST_VERSION_STALE.
    source: assumption A6, FR8.5, AC8.3.2, Q2, contract C19
  - id: BR76.2
    statement: Approving the cancellation of a rota duty frees and flags the week, and its weekend pick goes back to the weekend family.
    category: policy
    applies_to: [ChangeRequest, Place, RotaWeek]
    trigger: cancellation_decide (approve)
    logic: The order matters, because C5 place_release ends every open request on the place as withdrawn. So the request first becomes approved, with decidedByAccountId and decidedAt, and only then is the place freed with place_release, which then finds no open request to withdraw. Then C11 rota_adjust_picks_after_change is called with no new family (the C11 delta in functional-spec.md), which empties the rota week with reason cancelled, so it shows among the flagged duties (U6), removes the week's pick and gives its slot back to the weekend family. The administrator then fills the duty with BR74.1, which adds a new place. For a duty that is not a rota duty, approving removes the place the same way, as today. The family gets cancellation_decided, and approval.approve is audited. A request whose duty has started is answered by BR73.2.
    violation: Conflict refusal APPROVAL_ALREADY_DECIDED, APPROVAL_INVALIDATED or CANCELLATION_EXPIRED.
    source: Q3, assumption A6, AC6.1.3, NFR4
  - id: BR76.3
    statement: Rejecting a cancellation leaves the duty with the family and tells it.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: cancellation_decide (reject)
    logic: The request becomes rejected with endedReason administrator_rejected, the place returns to active, the family gets cancellation_decided, and approval.reject is audited.
    violation: Conflict refusal APPROVAL_ALREADY_DECIDED.
    source: assumption A6, AC8.3.2, NFR4
  # --- Shared ----------------------------------------------------------------------------------
  - id: BR77.1
    statement: Every command locks in one fixed order, so commands at the same moment end as if one came after the other.
    category: constraint
    applies_to: [ChangeRequest, Place, RotaWeek]
    trigger: every command of this unit
    logic: Before changing anything, a command works out every row it may touch, including the weekend slot duties and places of any picking or weekend week its change reaches through C11, and locks the duty rows in ascending id order, then the place rows in ascending id order, then the request row, all in one pass; only then does it call C5 and C11, whose own locks then find rows already held. The rota week and pick rows are locked inside C11 after that. This keeps U7's paths and U6's pick commands in the same order; the NFR Design stage confirms it against U6's lock tests. No command adds a family row lock just to check a family's standing. A repeated click with the same idempotency key returns the stored result (replayed) and does nothing again. Two acceptances, an acceptance and a withdrawal, or an acceptance and a reassignment at the same moment: the second one sees the first one's result and is refused when it no longer fits.
    violation: The refusal of the rule the second command now breaks.
    source: AC8.2.9, contract C1
  - id: BR77.2
    statement: The swap screens offer only places the parent's family could receive in a swap.
    category: policy
    applies_to: [Place]
    trigger: swap_candidates
    logic: For one of the family's own future places, the list holds other families' active future places of any kind (Q1), excluding weekend slot places (BR71.2), places in an open request, and duties the family already holds a place on. Each entry shows the duty, its time and the other family's name through C6, and nothing else about that family. It may be limited to a date range.
    violation: Not applicable; a read.
    source: FR8.2, AC8.2.1, Q1
  - id: BR77.3
    statement: Removing a parent or a family ends its open requests and clears the person from ended ones.
    category: policy
    applies_to: [ChangeRequest]
    trigger: dutychanges_removal_preview, dutychanges_removal_apply (C16)
    logic: For a removed family, every open request where it is the source or the target family becomes cancelled with endedReason family_removed, the other family's place returns to active and the other family gets swap_cancelled. For a removed parent, requestedByParentId is cleared on ended requests and decidedByAccountId is cleared where it is that person's account. For a removed family, the reason of every request it made or received is cleared too, because a reason may name a person (NFR1.4 of this Unit's NFR requirements). Past requests then show the person as korábbi tag through C6. The preview returns counts only. U14 runs this block in the C16 order, after U6's block.
    violation: Not applicable; follows the removal.
    source: contract C16, contract C6
  - id: BR77.4
    statement: Every rule of this unit has the fixed list of database tests.
    category: policy
    applies_to: [ChangeRequest, Place]
    trigger: tests/database
    logic: For proposing, accepting, declining, withdrawing, expiry, reassigning, reversing and deciding a cancellation the tests cover allowed, refused, out of reach, outdated screen, repeated click and two people at once. A case with no meaning for a rule is recorded in the test plan with the reason.
    violation: Not applicable; a delivery rule.
    source: team.md Testing Posture, contract C1
```

## Rules Summary

| Group | Rules | What they settle |
|---|---|---|
| Who may do what | BR70.1 to BR70.3 | Families propose and answer; only a super admin changes rota duties, reverses swaps and decides rota cancellations; reasons go to the other side and administrators only |
| Proposing | BR71.1 to BR71.5 | Any kind of duty, no group check (Q1); weekend slots never on their own (Q2); one open request per place; changeover and same-week rules; versions and reason stored |
| Answering | BR72.1 to BR72.5 | Accept applies at once if nothing changed; one transaction with the pick following the duty; decline and withdraw tell the other side |
| Expiry | BR73.1, BR73.2 | A swap ends when the earlier duty starts; an undecided cancellation ends when its duty starts and the family keeps the duty |
| Administrator | BR74.1 to BR75.4 | Reassign rota duties with the same rules; reassignment cancels a pending swap; reverse an applied swap only if unchanged; no more approving swaps (Q4) |
| Cancellation | BR76.1 to BR76.3 | Families ask, an administrator decides; an approved rota cancellation frees and flags the week (Q3) |
| Shared | BR77.1 to BR77.4 | Lock order and repeat safety; the candidate list; removal; the fixed test list |
