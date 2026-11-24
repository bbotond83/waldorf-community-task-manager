# Scalability Design: u8-animal-care-and-information

Sources: `scalability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md` and `rules.md` (BR81, BR82, BR85, BR87, BR89), and C1, C4, C5, C18 and C19 in `contract-summary.md`.

## Capacity

One community, about 20 families and 400 slots a year. Every read is bounded (at most eight weeks of slots, one row per family, a dozen sections), far below the data API's 1000-row limit. No scaling mechanism, cache or queue is added.

## Concurrency Design

| Case | Mechanism |
|---|---|
| Repeated click on any command (NFR5.1) | The existing `idempotency_records` table returns the stored result for the same account, command and inputs |
| Two families signing up for one slot (NFR5.2) | `duty_sign_up` locks the duty row first; the second caller finds the active place and gets DUTY_FULL |
| Give-up against a sign-up (NFR5.3) | `slot_give_up` locks the duty row, then the place (the same order as sign-up), so the two run one after the other |
| Give-up against a swap proposal (NFR5.4) | Both take the place lock; whichever comes second sees the place no longer active or in an open request and is refused |
| Two creations, or a creation and a time change (NFR5.5) | Both lock the calendar row first, so they run one after the other; the unique slot key backs the "one set" guarantee |
| Sign-up or give-up against a time change (NFR5.6) | The time change locks the calendar, then slot duties by ascending id; a give-up that locks the duty first sees the old time, one that waits sees the new time, and the 24-hour limit is judged on the time it read under its lock |
| Two editors of one section (NFR5.7) | The section row is locked and its version compared; the second save gets VERSION_CONFLICT |
| A daily check run twice at once (NFR5.8) | The empty-slot check relies on the per-family-per-day once key; the fair-share check inserts the month's round first under its unique key, so the second run finds it and stops |

## Lock Order (NFR5.9, BR89.1)

Calendar row, then slot duty rows by ascending id, then place rows by ascending id. Sign-up and give-up take duty then place, as U2 and U7 do. No command of this Unit locks a family row; standings are read without a lock, following the project rule against a row lock just to check a family's standing. The race tests run together with U7's swap race tests to show no deadlock.

## Review follow-up (after the owner review)

- **First calendar save**: a year with no calendar has no row to lock, so `animal_calendar_save` inserts the calendar with `on conflict do nothing`; of two saves at once the loser inserts nothing and reads `VERSION_CONFLICT` (migration 20261070). Every later calendar command still locks the calendar row first.
- **Blast radius**: three migrations, not one. 20261068 replaces `rota_duty_card`, `duty_rota_managed` and adds the new functions; 20261069 replaces `schedule_get`, which is shared with the events and teacher-schedule screens (it now leaves out animal-slot tasks, BR81.7); 20261070 replaces `animal_calendar_save` and `info_section_update`.
- **Teacher page**: `/teacher/allatok` reuses `animal_slots_list` and `animal_fair_share` read-only (the same two reads as the parent page, no call per row, no contact detail), and has the matrix row `/teacher/allatok/**` read (allow) and update (deny).
