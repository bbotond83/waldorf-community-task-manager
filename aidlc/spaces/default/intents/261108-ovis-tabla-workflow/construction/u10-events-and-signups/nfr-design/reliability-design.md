# Reliability Design: u10-events-and-signups

How the targets in `reliability-requirements.md` are met, following `functional-spec.md` and C8 and C16 in `contract-summary.md`. Nothing is hosted, so only data integrity and testing apply.

## Transactions

| Requirement | Design |
|---|---|
| NFR7.1 | `event_save` runs in one transaction: event row, notice rows, audit entry and the `notice_send` call. A refusal by `notice_send` raises and rolls everything back; the email is queued by U5 and retried there, so a failed email changes nothing here. |
| NFR7.2 | Cancel updates the event status and closes its open tasks in the same transaction. |
| NFR11.1 | The removal pair runs in the caller's transaction. Preview counts; apply clears `parent_id` and `family_id` on sign-ups and offers, `parent_id` and `is_organiser` on roles, and exactly matching typed names, keeping the rows. |

## Database rules

| Requirement | Design |
|---|---|
| NFR7.3 | Table check constraints enforce what one row can show: organiser only with a parent, not both parent and typed name, notice position 1 to 10, and end not before start. A unique constraint keeps each notice position once per event. The limits (10 notices, 20 roles, 10 sign-ups, 20 offers) and the food-off rule for new offers are checked inside the save and add functions under the event lock, because a constraint cannot count rows or know the caller and existing offers must stay (BR102.1). Tests insert directly as the database owner for the row-level rules; the counted rules are tested through the functions. |
| NFR7.4 | The row check allows a role with neither person, since a removal produces one. The save functions require exactly one person, so a caller can never create or save such a role; only the removal functions clear a person. |
| NFR7.5 | One forward-only migration adds columns and tables and drops the three notes and the coordinator name. Events, tasks and places are not rewritten. |
| NFR7.6 | Event end and deadline are compared as Budapest dates inside the functions. |
| NFR7.7 | All changes go through `npm run verify:local` and the `Validate` check. |

## Testing

| Requirement | Design |
|---|---|
| NFR6.1 | Application code (read models, facade, screens) is covered by Vitest to the existing 80% floor. |
| NFR6.2 | Each rule gets a test file under `tests/database/` with the fixed list, and the plan table shows each cell. |
| NFR6.3 | New files are named in their `test:database:*` script and the shuffled run; `identity-catalogue.test.ts` and `notification-use-cases.test.ts` are extended. |
| NFR6.4 | One test file calls the internal functions and the removal pair as the database owner. |
| NFR11.2 | The existing event-task tests run unchanged against the converted structure. |
