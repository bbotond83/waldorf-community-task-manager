# Code Summary: Audit purge isolation

## Files created or modified

- Created `supabase/migrations/20261045_audit_purge_isolation.sql`: redefines `audit_purge()` and `identity_housekeeping()` and restates their rights.
- Modified `tests/database/audit-purge.test.ts`: two cap tests (5001 aged rows give 5000 then 1, oldest first; exactly 5000 leaves none).
- Modified `tests/database/identity-housekeeping.test.ts`: a failing-purge test and the `audit_purge_failed: false` check in the success test.
- Modified `tests/database/migrations.test.ts`: tracking test for the new file.
- Modified `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`: B1 marked done, with the three recorded limits.

## Key decisions

- The cap is 5000 rows, chosen by age through the existing `audit_events_time` index and deleted by id, so one call stays short.
- The isolation is a `BEGIN ... EXCEPTION WHEN OTHERS` block around the purge. Postgres rolls back the sub-transaction's changes, including the transaction-local deletion setting, so the setting is off again after a failure.
- The result keeps all existing fields and adds `audit_purge_failed` (true or false). No error text is returned or logged.
- Recorded limits (review R-01, R-04): the exception block does not catch a cancelled query, so a statement timeout on the calling statement still ends the whole call and the cap is the protection against timeouts; a failed purge is visible only through the flag until alerting is added.

## Test coverage summary

Real-stack run on the local database (Docker stack from `npm run db:start`): `audit-purge`, `identity-housekeeping`, `migrations` and `identity-catalogue` files: 91 tests, 0 failures. The whole identity group (`npm run test:database:identity`): 332 passed. The seed group (`npm run test:database:seed`, includes the purge file): 57 passed. `npm run typecheck`, `npm run lint` and `npm run format:check` pass. No production TypeScript changed, so TypeScript coverage is unchanged.

## Tests written but not run in this stage

- The shuffled-order database run (`npm run test:database:shuffled`) and the other database groups (directory, notifications and import, stack): not run locally; CI runs them. They do not touch the changed functions.
- A statement-timeout cancellation of the purge is not tested: it is a documented limit, not a behaviour of this change.

## Deviations from the plan

None. The migration was written before the plan file because the design was already settled in the requirements; the plan describes it as built.
