# Test Results: B3 denied-call audit rate limit

Branch `fix/denied-audit-rate-limit`, working tree on top of `origin/main` 02b4686 (changes not yet committed). Node 24.22.0, local Supabase stack running. Date 2026-10-27.

## Build status

Success. `npm run build` passed inside `npm run verify:local` (run 3, exit 0).

## Full local verification (`npm run verify:local`)

| Run | Environment | Result |
|-----|-------------|--------|
| 1 | Shell without the CI job environment | Every step up to and including the security scans passed; stopped at `build` because the production config check needs `APP_SESSION_SECRET` (environment, not code) |
| 2 | Partial environment | Stopped at the build config check (`SUPABASE_URL` missing); no new information |
| 3 | The CI validate job's environment (stack address and keys from `supabase status`, fresh session secret, SMTP settings, `VERIFY_BROWSER_PROJECTS=chromium` as for a pull request) | Failed at `database-identity`: `tests/database/identity-lockout.test.ts:193` "handles two simultaneous wrong attempts without an error" expected 2 sign-in attempt rows, found 3 |
| 4 | Same as run 3 | **Passed, exit 0** |

Run 3's failure is judged unrelated and intermittent: the test does not touch the audit write (`sign_in_attempt_record` only inserts into `sign_in_attempts`), it passed in run 1 and run 4, and the file passed 24 of 24 when run alone right after. It is recorded here as an observed intermittent failure, not fixed in this change.

## Results of run 4

| Step | Passed | Failed |
|------|--------|--------|
| Unit and script tests (`npm test`) | 511 + 251 | 0 |
| Delivery tests (Vitest) | 836 | 0 |
| `database-stack` (includes the new file) | 131 | 0 |
| `database-identity` | 332 | 0 |
| `database-directory` | 352 | 0 |
| `database-notifications-import` | 256 | 0 |
| `database-seed` | 57 | 0 |
| `database-shuffled` (randomized order, includes the new file) | all groups | 0 |
| `database-import-timing` | attempt 1 failed (timing), retry passed 2 of 2 | as designed (C2: one automatic retry, both results printed) |
| Coverage | Statements 96.96%, Branches 90.98%, Functions 95.73%, Lines 97.94% | floor 80% met |
| Security (privacy, secrets, SAST, no-deploy scans, `npm audit --audit-level=high`) | all pass, 0 vulnerabilities | 0 |
| Build, bundle check, start smoke | pass | 0 |
| Browser suite (Chromium) | 155 | 0 |
| Linked-target and Safari evidence | not invoked; status OUTSTANDING (as for every local run) | - |

New tests in `tests/database/audit-denied-limit.test.ts`: 7 tests in each of `worker_1` and `public`, all passed. Migration-order test for `20261046`: passed.

## Lock check (closes the gap noted in Code Generation)

To show that the concurrency test (test 6) catches a missing lock, the `public` copy of `platform_audit_write` was temporarily replaced by one without `pg_advisory_xact_lock` (and with a 0.05 s pause between count and insert to make the race visible), and test 6 was run:

- Without the lock: **failed**, 25 events stored instead of 20 (`public`); `worker_1`, still locked, passed.
- After restoring the real definition from the migration file (checked: lock present, no pause): passed 2 of 2.

The throwaway script lived in the record's git-ignored engine folder and was deleted.

## Failures

None in the final run. Intermittent: `identity-lockout.test.ts:193` (run 3, see above).

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|-----------|--------|----------|--------|----------|--------------|---------|
| T-TYPE | team.md Testing Posture | strict type check passes | pass | verify:local `typecheck` log | build-and-test | Met |
| T-LINT | team.md Code Style | Prettier and ESLint pass | pass | verify:local `format`, `lint` logs | build-and-test | Met |
| T-TESTS | team.md Testing Posture | all tests pass, existing suite green | 0 failures in run 4 | verify:local run 4 | build-and-test | Met |
| T-NEW | code-generation-plan.md Step 4, Testing Contract (Minimal) | one test per requirement, real stack | 7 tests x 2 schemas + 1 migration test, all pass | `database-stack` log; traceability | build-and-test | Met |
| T-COV | team.md Testing Posture | at least 80% line, branch, function | 97.94% / 90.98% / 95.73% | verify:local `coverage` log | build-and-test | Met |
| T-BUILD | team.md Testing Posture | production build passes | pass | verify:local `build` log | build-and-test | Met |
| T-SMOKE | team.md Testing Posture | deterministic start smoke passes | pass | verify:local `smoke` log | build-and-test | Met |
| T-BROWSER | team.md Testing Posture | critical browser flow passes, no serious or critical accessibility violations | 155 passed (Chromium) | verify:local `browser` log | build-and-test | Met |
| T-DEPS | project.md Testing Posture | no high or critical dependency findings | 0 vulnerabilities | `npm audit --audit-level=high` | build-and-test | Met |
| T-SAST | team.md Code Style | secret scan and SAST clean | pass | verify:local `security` log | build-and-test | Met |
| T-NFR1 | requirements.md NFR1 | never more than 20 under simultaneous calls | exactly 20 of 25; test fails without the lock | test 6 and the lock check above | build-and-test | Met |
| T-CI | Testing Contract (CI execution) | CI runs the tests before merge | not applicable here | the plan runs no CI Pipeline stage (`ci-pipeline` SKIP); the repository's own CI will still run on the pull request | - | N/A |
