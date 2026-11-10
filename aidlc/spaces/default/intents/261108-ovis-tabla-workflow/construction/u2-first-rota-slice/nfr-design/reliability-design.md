# Reliability Design: u2-first-rota-slice

How the targets in `reliability-requirements.md` are met. Nothing is hosted, so no availability design applies; the design is about all-or-nothing changes and tests.

## Transactions

| Requirement | Design |
|---|---|
| NFR7.1 | Publish is one function and so one transaction: duties, places, notices, audit event and the published mark commit together. A failure at any step rolls back to a draft with no side effects. The test forces the failure without changing production code: a test-only trigger on the `notifications` table raises an error on the first notice insert, which happens after the duties and places exist, so everything already inserted must roll back. |
| NFR7.2 | Making a draft inserts the plan and its week rows in one function; a failure leaves no plan row. |
| NFR7.3 | A partial unique index on the duty's origin kind and id (only where the origin is not `manual`, since manual duties have no origin id), and the capacity check with the existing unique family-and-duty index on places, make a second duty or place for a week impossible at the database. A duplicate test calls `duty_create` twice for one week through the publish path. |
| NFR7.4 | The migration only adds columns with defaults, new tables and wider checks: the school year's changeover date; the break week, plan and week tables with a unique plan per school year; the duty origin columns and the partial unique index; the `assignments.source` check widened with `rota_publish`; the place done mark; the `notifications` kind, target and optional task checks and the dedupe key; and the audit action check. Existing duties take origin `manual`. A test applies it over a seeded database, compares row counts, and has one row for each change in the list. |
| NFR7.5 | `npm run verify:local` is the gate, unchanged. |

## Recovery

Forward-only: a defect is fixed by a new migration file. A mistaken published plan is reset locally (`db:reset`, `db:seed`) until U7.

## Tests

| Requirement | Design |
|---|---|
| NFR6.1 | Application code added here (pages, parsers, message mapping) keeps the 80/80/80 thresholds unchanged. |
| NFR6.2 | The unit's test plan lists each rule with its six cases and a named test or "nem értelmezhető" with the reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run in the same change. |

## Existing Behaviour

| Requirement | Design |
|---|---|
| NFR11.1 | The family archiving function checks for a place on a rota duty and refuses with DUTY_ROTA_MANAGED; any other family is unaffected. |
| NFR11.2 | The reminder planning and the task-based notice lookups filter on a present task, so notices of the new kind never enter them. |
