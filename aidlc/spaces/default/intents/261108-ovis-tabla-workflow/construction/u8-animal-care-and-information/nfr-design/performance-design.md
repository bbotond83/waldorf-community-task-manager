# Performance Design: u8-animal-care-and-information

Sources: `performance-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md`, and C1 and C9 in `contract-summary.md`.

## Read Shapes

| Read | Shape | Why it is fast enough |
|---|---|---|
| `animal_slots_list(year, from_date, weeks)` | One document: the requested weeks' slots (default two weeks, at most eight), each row with the fields listed in `functional-spec.md` and its duty links | About 20 to 80 rows; one join over slots, their duties and the active place; the links come from the six sections already in memory of the call (NFR9.1, NFR9.5) |
| `animal_fair_share(year)` | One document: the average, and per family its count and own share | One count of active slot places grouped by family, joined to the C20 standings; about 400 places and 20 families (NFR9.1) |
| `info_sections_list()` | One document with every visible section and whether the caller may edit it | Six to a dozen rows; the owner group is resolved once per distinct owner name (NFR9.1) |
| `animal_calendar_get(year)` | One row | — |

The sign-up page calls the first two reads, the information page one and the settings screen one; no page calls per row (NFR9.5).

## Indexes

- Slots: unique on calendar, date and part (also the duplicate guard, NFR7.5); an index on date for the three-day window and the list's week range.
- The existing duty index on origin kind and origin id (`tasks_one_per_origin`) finds a slot's duty; the existing place index on duty finds its active place.
- Information sections: unique on community and key.
- Fair-share rounds: unique on calendar and month.

## Commands

- **Sign-up and give-up** touch one duty and one place under the existing locks (NFR9.2).
- **Creating slots** builds the missing date and part pairs in one set-based statement from C3 `school_weeks`, inserts slots and duties with "on conflict do nothing" and returns the count; about 400 rows the first time and none on a repeat (NFR9.3).
- **A start-time change** updates the coming slot duties' start and end times in one statement ordered by duty id, then sends one notice per holding family (NFR9.3).

## Daily Checks

- `animal_empty_slots_check` reads the free slots of three dates and the families' standings once, then calls `notice_send` once per family and once for the alert group (NFR9.4).
- `animal_fair_share_check` returns at once on every day but the round day; on that day it runs the same grouped count as `animal_fair_share` (NFR9.4).

## Measurement

`db:seed:large` gains a school year's slot calendar and slots with about 60% held by invented families, and section text of realistic length. Timings are the median of 5 warm runs after one warm-up run on the owner's computer (NFR9.1 to NFR9.4).

## Screens

- All copy is Hungarian, with the decimal comma for shares (NFR8.1).
- The sign-up page, the information page and editor, the settings screen and the duty-card links are designed in Stitch first and built with the `parent-`, `admin-` and new `info-` class prefixes; slot buttons carry the day and part in their names, results go to a status region and focus stays on the row (NFR8.2).
