# Code Summary: B3 denied-call audit rate limit

## Files created or modified

Branch `fix/denied-audit-rate-limit`, based on `origin/main` 02b4686. Nothing committed yet.

| File | Change |
|------|--------|
| `supabase/migrations/20261046_audit_denied_rate_limit.sql` | New. Partial index `audit_events_actor_denied` on denied events; `platform_audit_write` replaced with the same signature and the per-account limit; its `revoke` restated |
| `tests/database/audit-denied-limit.test.ts` | New. 7 behaviour tests, each run in `worker_1` and `public` (14 test runs) |
| `tests/database/migrations.test.ts` | One migration-order test for `20261046` |
| `package.json` | New test file added to `test:database:stack` |
| `scripts/db/shuffled-tests.ts` | New test file added to the shuffled database run |
| `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md` | Dated Done note under B3; Group F decision 1 marked decided |

## Key implementation decisions

- The limit lives only in `platform_audit_write`, so every function that records a denied event gets it (FR5). No caller changed: `platform_finish_operation` ignores the return value, so the call and its replay still answer `denied` (FR2).
- For a denied event from an account other than the system account, the function takes a per-account transaction lock, counts that account's denied events in the last 60 minutes, and returns `null` without writing when 20 or more exist (FR1, FR4, NFR1). The limit and window are named constants citing the owner decision.
- The count uses a new partial index limited to denied events (NFR3).
- The function keeps `security definer`, `set search_path from current` and its revoked rights (NFR2).

## Test coverage

- Tests executed in this stage (local stack running, Node 24.22.0):
  - `node --experimental-strip-types --test tests/database/audit-denied-limit.test.ts`: 14 of 14 passed.
  - `node --experimental-strip-types --test tests/database/migrations.test.ts tests/database/audit.test.ts`: 44 of 44 passed.
  - `node --experimental-strip-types --test scripts/db/shuffled-tests.test.ts scripts/verification/ci-config.test.ts`: 23 of 23 passed (the test-list consistency checks).
  - `npm run typecheck`, `npm run lint`, `npm run format:check`: passed.
- The SQL is outside the TypeScript coverage measurement; no production TypeScript changed.

## Tests written but not executed in this stage

- The full `verify:local` run (other database groups, the shuffled database run, the coverage run, build and browser suite) was not executed here; it is left to Build and Test and to CI.

## Deviations from the plan

- Step 2: `unit-test-instructions.md` was not edited; it already records the exact commands.
- Step 4, test 4: the success event "at the limit" is produced by `SUPER_ADMIN` (filled with 20 recent denied events first), because `PARENT` cannot place a hold successfully. The second half (20 success events do not block a denial) uses `PARENT` as planned.
- Step 4, test 7: additionally checks that the function is still `security definer` with a pinned `search_path`.

## Known limits

- It has not been shown that the concurrency test (test 6) fails when the lock is removed; it passes with the lock.
- Suppressed denials are not counted anywhere (by decision).
