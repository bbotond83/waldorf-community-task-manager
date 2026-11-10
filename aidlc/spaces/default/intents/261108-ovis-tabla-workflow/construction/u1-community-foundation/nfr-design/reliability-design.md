# Reliability Design: u1-community-foundation

How `reliability-requirements.md` is met, following `functional-spec.md`, `tech-stack-decisions.md` and `contract-summary.md`.

## Structure Change

| Requirement | Design |
|---|---|
| NFR7.1 | One migration file holds the clean start, the structure change and the rewritten rules. The migration runner adds no transaction of its own, so the file opens and commits one itself, as `20261006_current_roles.sql` does. A failure leaves everything as it was. Old rules can never run against the new structure. |
| NFR7.2 | The same file drops the import's functions and tables. The catalogue test lists what must and must not exist afterwards. |
| NFR7.3 | Database, application and tests change in the same pull request, so `npm run verify:local` always judges a matching set. |

No retry, circuit breaker or failover applies: the only dependency is the local database, and a failed request shows the existing error state.

## Test Design

| Requirement | Design |
|---|---|
| NFR6.1 | The coverage thresholds stay at 80. Code removed with the import leaves the measure. |
| NFR6.2 | The Unit's test plan carries one table with a row per rule and six case columns (BR6.2). |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. |

Existing tests that assert kindergarten-group behaviour change in the same pull request. They are rewritten to the new rules, not deleted, except the import tests.

## Existing Behaviour

NFR11.1: `lifecycle_run` deletes the memberships of the family's parents in place of the family's own. Its other steps do not change.
