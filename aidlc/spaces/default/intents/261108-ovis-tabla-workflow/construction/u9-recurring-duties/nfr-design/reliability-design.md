# Reliability Design: u9-recurring-duties

Sources: `reliability-requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C8, C9 and C16 in `contract-summary.md`. Nothing is hosted, so no availability target applies.

## Approach

All changes run in one database transaction per command, so a failure leaves nothing behind (NFR7.1, NFR7.2). The database constraints are the second line of defence behind the functions (NFR7.3). Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Decision D-REL-1: exact notice window (settles review finding R-02)

`days_past` is today's Budapest date minus the occurrence's due date. The daily check works on open occurrences only (not done, not skipped).

| days_past | Due notice | Overdue notice |
|---|---|---|
| less than 0 | no | no |
| 0, 1 or 2 | sent if none sent yet | no |
| 3 or more | never (not sent late any more) | sent if none sent yet |

Consequences:

- On the due date the owner gets "Esedékes" (BR149.1). If the daily run was missed, the due notice is still sent on day 1 or 2 (a late due notice), at most once.
- From day 3 only "Lejárt" is sent. A family never receives both in one run. If the due notice was never sent (a schedule saved late, or runs missed for three days), the owner gets just the overdue one.
- Each notice goes through `notice_send` with a once key built from schedule and due date and the kind, so repeats and racing runs send one notice (NFR5.6).
- BR149.1 is read with this window: "on the due date, or on the next daily run within two days after it if that run was missed".
- A schedule saved after that day's run creates today's occurrence at once (BR144.1), and the next daily run sends its due notice the same day or the day after, still inside days 0 to 2.

Tests (NFR7.4), each reading the notices created:

| Situation | Expected |
|---|---|
| Run on days 0, 1, 2 with no earlier run | one due notice, once |
| Run on day 3 and day 4, due notice sent on day 0 | one overdue notice, no second |
| First run only on day 2 | one due notice |
| First run only on day 3 | one overdue notice, no due notice |
| Save after the day's run, run next day | one due notice |
| Run twice on the same day | no duplicate |

## Decision D-REL-2: daily check and email failures (NFR7.5)

`recurring_due_check` is registered in U5's `timed_check_registry` by this Unit's migration; U5's function is not edited. A failing check is stored in U5's run record with its error code and does not stop the other checks. Notices are created inside the check; sending the email is U5's sweep, so a failed email never fails the check.

## Decision D-REL-3: the marker for a removed parent (settles review finding R-03)

Occurrences carry two plain flags: `done_by_removed` and `skipped_by_removed`, both false by default. The state constraints are:

- Done: `done_at` set, and either a done-by person or `done_by_removed` true. Not done: no done-by person, `done_by_removed` false, `done_at` empty.
- Skipped: `skipped_at` and a reason set, and either a skip person or `skipped_by_removed` true.

`recurring_removal_apply` for a parent clears the person and sets the flag in one update, so the constraint never fails. For a family it writes nothing (BR151.1). The screens show "korábbi tag" when the flag is true. Tests cover both sides: a removed parent's row is valid and an unrelated done row without a person is refused (NFR7.3, NFR7.8).

## Time (NFR7.6)

All due dates, seasons, the 14-day lead, the 3-day overdue point, the 24-hour undo window and the 60-day cut are computed in Budapest time inside the database from a moment argument that defaults to now, so tests set moments directly, including both clock-change weeks.

## Rota-week counting (NFR7.7)

Counting takes the published water-carrying weeks in order and numbers them from the start of the school year. A republish keeps the numbering because it counts by the week's date, not by row identity. The unique key on schedule and due date stops a republish from creating a second occurrence, and the school-year boundary restarts the count at the first published water week of the new year (BR143.2). Tests republish a plan and run across a year boundary.

## Other requirements

| Requirement | Design |
|---|---|
| NFR7.9 | One forward-only migration adds two tables and registry rows; no existing row changes; the seed gains the starting list |
| NFR7.10 | `npm run verify:local` unchanged, run in three browsers by `Validate` |
| NFR6.1 to NFR6.4 | Tests as listed in the requirements; each new database test file is added to its `test:database:*` script and to the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended |
| NFR11.1, NFR11.2 | The removal pair returns counts in preview and apply; a swap writes no row of this Unit, so existing swap and rota tests pass unchanged |
