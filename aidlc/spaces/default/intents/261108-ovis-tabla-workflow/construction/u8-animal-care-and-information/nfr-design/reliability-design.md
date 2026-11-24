# Reliability Design: u8-animal-care-and-information

Sources: `reliability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md` and `rules.md`, and C3, C4, C5, C8, C9, C16 and C20 in `contract-summary.md`. Nothing is hosted, so there is no availability target, failover or backup design in this Unit.

## Atomic Commands

| Command | What commits together | Outside the transaction |
|---|---|---|
| `animal_slots_create` | Every missing slot and its duty, the calendar's creation time, the audit entry (NFR7.1) | Nothing |
| `animal_calendar_save` | The calendar, every moved slot's start and end, the holders' in-app notices, the audit entry (NFR7.2) | The emails, queued by `notice_send`; a failed email never rolls the change back |
| `slot_give_up` | The released place and its stored result | — |
| Section commands | The section row and its stored result | — |

## Time

- A slot's start is built in the database from its local date and the calendar's local time in `Europe/Budapest`, so a 07:30 slot is at 07:30 on the clock in both clock-change weeks (NFR7.3).
- The 24-hour limit compares the call's moment with the slot's start moment; the windows of the daily checks take the run's Budapest date and add calendar days (NFR7.3, NFR7.4).
- "First weekday of the month" is the first date of the month whose Budapest weekday is Monday to Friday; months that start on a Saturday or Sunday get the following Monday (NFR7.4).
- Both checks take the run's moment as an argument (C9), so tests set the moment instead of waiting.

## Database Guards (NFR7.5)

Unique slot per calendar, date and part; a check that the slot's date is Monday to Friday; a check that the morning time is earlier than the afternoon time; a unique round per calendar and month; a unique section key per community; length and season-month checks on sections.

## Migration (NFR7.6)

One new forward-only migration file: it re-creates the duty origin check with `animal_slot` added, creates the four tables, functions and grants, registers the notice kinds, the target type and the two daily checks, re-creates the audit action check with the complete list (NFR4.4), replaces `rota_duty_card` with the `info_links` field, and inserts the six sections with their owner names. It runs over a seeded database with or without the named working groups, because owners are names.

## Daily Run (NFR7.7)

Each check returns its created and skipped counts to the daily run. A failure inside a check is caught by the daily run, recorded in `timed_check_runs` and does not stop the other checks; a second run the same day creates nothing (once keys and the round's unique key).

## Delivery Checks (NFR7.8)

Every change passes `npm run verify:local` in all three browsers. Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Design

- Coverage stays at 80% or more; the section-text renderer gets its own colocated component tests (NFR6.1).
- The test plan lists every rule BR80.1 to BR89.1 against the fixed list (allowed, refused, out of reach, outdated screen, repeated click, two people at once), each cell naming a test or "nem értelmezhető" with its reason (NFR6.2).
- New database test files are added to their `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended for the new functions, tables and notice kinds (NFR6.3).
- Worked fair-share examples cover staying only, leaving and new families, a family with no standing row, no held slot, and a family exactly at its share (NFR6.4).

## Existing Behaviour

- Removal: slots are places, so U2's block frees future slots and past ones show "korábbi tag"; the Unit's own tables hold no person (NFR11.1, C16).
- Sign-up, swaps and duty reminders are used unchanged; `rota_duty_card` only gains `info_links`, and its existing tests pass apart from the new field (NFR11.2).
