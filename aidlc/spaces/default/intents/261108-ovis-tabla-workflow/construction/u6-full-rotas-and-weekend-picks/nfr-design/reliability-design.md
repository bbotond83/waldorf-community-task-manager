# Reliability Design: u6-full-rotas-and-weekend-picks

How the targets in `reliability-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and C8, C9 and C16 in `contract-summary.md`. Nothing is hosted, so no availability design applies; the design is about all-or-nothing changes, time and tests.

## Transactions

| Requirement | Design |
|---|---|
| NFR7.1 | Publish stays one function and one transaction: weekly duties, weekend slots and their duties, places, notices, audit event and the published mark. A refusal raised by `notice_send` rolls it back. The email is only a queued row at that point and is sent later by the delivery pass, so a mail failure cannot reach the transaction. The forced-failure test uses a test-only trigger, as in U2. |
| NFR7.2 | One internal step writes the pick row and moves the place; both happen inside the calling command's transaction. An invariant query (every pick's slot is held by its picking week's family, and every weekend place with source `weekend_pick` has a pick) runs at the end of every pick test. |
| NFR7.3 | Unique indexes: one pick per picking week, one pick per slot, one slot row per weekend week and slot kind, one standing per family and year. The duty's unique origin index from U2 covers one duty per slot. A check keeps the shelter cleaning out of picks. |
| NFR7.4 | The migration is additive: the standings table, the weekend slot and pick tables, wider value lists for rota job, empty reason, duty origin, place source and audit action, and registry rows. One statement adds the three new rotas' rows to every existing plan with reason `not_drafted`. A test applies it over a seeded database with a draft and a published plan and compares row counts. |
| NFR7.5 | One helper turns a week's Monday and a moment into the three boundaries (Wednesday 00:00, Friday 12:00, Saturday 00:00) in Budapest time, and every rule and check uses it. Local dates are built first and converted to instants, so the clock-change weeks need no special case. |
| NFR7.6 | The run already records a failing check and carries on (C9). Each check asks "is this due and not yet sent?" instead of "is today Wednesday?", so a late run catches up and a second run sends nothing. |
| NFR7.7 | `npm run verify:local` is the gate, unchanged. |

## Recovery

Forward-only: a defect is fixed by a new migration file. A mistaken published plan is reset locally (`db:reset`, `db:seed`) until U7.

## Tests

| Requirement | Design |
|---|---|
| NFR6.1 | Application code added here (pages, parsers, message mapping) keeps the 80/80/80 thresholds unchanged. |
| NFR6.2 | The unit's test plan lists each rule with its six cases and a named test or "nem értelmezhető" with the reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run in the same change. |
| NFR6.4 | One database test file builds each combination of the grid in a rolled-back transaction, makes the draft and asserts the properties with queries, so a failure names the combination. |
| NFR6.5 | A second file calls the functions for later units as the database owner, building the published plan it needs first. |

## Existing Behaviour

| Requirement | Design |
|---|---|
| NFR11.1 | The removal pair counts the family's future rota weeks and picks and writes nothing; a removed family fails the eligibility check, so its duties read as flagged. Standings, weekend slots and picks hold no person, only a family id; clearing or keeping them when a family is deleted or anonymised is decided with U14, which calls this pair. Archiving keeps U2's refusal for a family holding a rota or weekend place. |
| NFR11.2 | `duty_create` plans no old-style reminder job, and the old reminder check skips duties that are not `manual`, so only this Unit's checks remind about rota and weekend duties. |
