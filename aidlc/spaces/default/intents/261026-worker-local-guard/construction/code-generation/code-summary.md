# Code Summary: Worker local-only guard

## Files created or modified

- Modified `scripts/db/local-guard.ts`: `assertLocalStack` and `connectLocalStack` take an optional `{ requireManaged }` (default `true`); only the "tracking table must exist" reason depends on it.
- Modified `scripts/db/worker.ts`: `setupWorker` connects through `connectLocalStack(settings, deps.connect, { requireManaged: false })` inside the existing error-wrapping block, so a refusal carries step `guard` plus the worker and schema, and a refused database's connection is closed before any statement.
- Modified `scripts/db/local-guard.test.ts`: two tests (default still requires the tracking table; with it off, a database without the table passes while every other identity reason still refuses).
- Modified `scripts/db/tooling.test.ts`: the worker tests use the CLI's default local password and a fake database that answers the identity query; three new guard tests (non-default password refused before any connection; non-local database refused, closed, only the identity read asked; never-migrated stack still works).
- Modified `tests/database/worker.test.ts` (real stack): the unreachable-database test uses the default password and still fails at `connect`; a new test shows a wrong password fails at `guard`.
- Modified `README.md`: the `db:worker` row says it refuses anything but the local stack.
- Modified `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`: B5 marked done with the decision and limits.

## Key implementation decisions

- The worker reuses the existing guard rather than a copy, so the seed, the reset and the worker cannot drift apart.
- The tracking-table requirement is relaxed for the worker only (review R-02): `db:start` does not migrate, and the worker is itself one of the tools that creates the table. The stricter alternative was considered and rejected; the reasoning is recorded in the follow-up plan.
- A local stack with a custom database password is now refused by `db:worker` (review R-01); the refusal message from B4 already says what to do.

## Revision after the code review

- R-01: the password refusal message now says "The database tools that change data (the seed, the reset and the test workers) work only with the Supabase CLI's default local database password", so a `db:worker` user is not told about commands they did not run; the B4 test still matches its key phrases and now also checks the message names the test workers.
- R-02: `setupWorker` reports the same step in `error.step` and in `detail.step` for a guard refusal (the error knows best which step failed while connecting); both guard tests assert `detail.step`.
- Residual (review R-03, recorded): a hosted database behind a loopback tunnel with the default password and no tracking table is stopped only by the database-name, role and JWT-secret checks, the same strength as the seed minus one signal.

## Test coverage summary

`scripts/db/local-guard.test.ts` and `scripts/db/tooling.test.ts`: 51 tests passed; against the previous `worker.ts` the two refusal tests fail. `tests/database/worker.test.ts` on the real local stack: 13 passed. Type check, lint and format pass. Full suite and coverage are run in Build and Test.

## Tests written but not executed in this stage

None.

## Deviations from the plan

None.
