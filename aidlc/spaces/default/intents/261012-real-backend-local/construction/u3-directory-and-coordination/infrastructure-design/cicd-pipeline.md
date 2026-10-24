# CI/CD Pipeline: U3 Directory, settings and coordination

The existing workflow `.github/workflows/ci.yml` keeps its jobs; no deployment workflow is created or enabled. U3 adds test stages inside the existing steps. Source: the NFR requirements, U1's and U2's CI design, and the team rules (immutable action revisions, blocking checks, private evidence records).

## Files That Change

| File | Change |
|---|---|
| `scripts/verification/run-local-verification.ts` | Add the U3 database stage after the identity stage: the role matrix for U3 tables and functions, the catalogue and privilege tests, the race and crossing-lock tests, the lifecycle completeness test, the placeholder-table catalogue check, the result-code contract test, the migration repeatability test for U3's files, and U2's identity tests re-run on the rewritten functions |
| `package.json` | New script for the U3 database group (`test:database:directory`); the `lint`, `format` and `format:check` folder lists are extended with every folder U3 adds code to (at least `src/directory`, `src/coordination`, `src/parent-experience`-replacement folders and any new adapter folder), and a small test fails when a source folder under `src` or `app` is outside the lint and format scope; no new dependency |
| `scripts/db/shuffled-tests.ts` and its test | Every new U3 database test file is added to the hard-coded `DATABASE_TEST_FILES` list so the shuffled-order run (NFR3.9) covers it |
| `scripts/verification/ci-config.test.ts` | Asserts the new `run-local-verification.ts` key (`database-directory`) and the new package script, as it does for the existing keys |
| `.github/workflows/ci.yml` | No change expected; if the new stage needs more time, only the existing job timeout is raised |
| `tests/` | New database, component, contract and browser tests (swap flow, incoming swaps, extended admin forms, notification page for a real parent) |

## Stages

1. Install, static checks (type check, lint, format check) and scans (secret, privacy, dependency audit, SAST, no-deployment), as before.
2. Start the stack with the same command.
3. Migrate and test: U1's database tests, then U2's existing `database-identity` step, which already runs after the migrations and so is the re-run of the identity tests on the rewritten functions (U3's migrations sort after U2's, are numbered above `20261023`, and the placeholder-table drop file sorts last), then U3's new `database-directory` step: policy matrix (NFR1.26), catalogue and privilege (NFR1.27, NFR1.28), reach tests (NFR1.32), swap and decision tests (NFR1.33), lifecycle (NFR1.36), races and crossing locks (NFR3.7, NFR3.8, NFR3.11), timings (NFR4.6 to NFR4.9), migration repeatability (NFR6.9), the code-by-code contract test and the old-constants search test (NFR2.17), the cross-organization isolation test (NFR1.31), the schedule privacy shape test (NFR1.30), the injected-failure atomicity test per use case (NFR6.10), the idempotency replay test (NFR6.11), the stale-version test per operation (NFR6.12), the test that the placeholder-table drop is skipped when a deliberate user exists (NFR6.14), the exported U4 hand-off list test (NFR6.16), the lifecycle-only-removal test (NFR3.10), the output scan for personal data (NFR1.35, NFR1.39) and the validation and injection tests (NFR1.34), also in a shuffled-order run (NFR3.9). Time budget: U1 and U2 steps take about as long as today; the U3 step is estimated at under 10 minutes including the 150-family data set and the race tests, within the job's existing 45-minute timeout (raised only if the first full run shows otherwise).
4. Production build and start smoke.
5. Browser and accessibility checks: the swap flow with two people signed in at once, the incoming-swaps page, the extended admin forms, the notification page for a real parent (NFR6.15), each with the automated accessibility scan (NFR5.4), and one reported-only timing of the parent task list page on the 150-family data set (NFR4.6).
6. Coverage: at least 80% lines, branches and functions across all production source, measured after the old modules are deleted (NFR2.16).
7. Stop the stack (always), then the existing private evidence records.

## Stage to Gate Mapping

| Stage | Blocks merge when |
|---|---|
| Static checks and scans | Any finding |
| Start the stack | The stack is unhealthy or a published port is not loopback-only (U1) |
| Database tests | Any policy, catalogue, privilege, reach, race, lock, lifecycle, contract, atomicity or timing-ceiling test fails, or U2's identity tests fail after the rewrite |
| Build and start smoke | The build or the smoke fails |
| Browser and accessibility | A failure or a serious or critical accessibility violation |
| Coverage | Below 80% lines, branches or functions on production source |

## Deployment Strategy, Rollback and Promotion

Not applicable: no deployment workflow exists. Rollback of a bad merge is a revert on `main`; local recovery is a reset (U1 NFR6.3).

## Secrets Management in CI

Unchanged: the stack's local defaults are not secrets, the session secret is generated per run, the service-role key is never printed, and actions stay pinned to immutable revisions.
