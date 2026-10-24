# CI/CD Pipeline: U4 Notifications and Excel import

The existing workflow `.github/workflows/ci.yml` keeps its jobs; no deployment workflow is created or enabled. U4 adds test stages inside the existing steps. Source: the NFR requirements, U1 to U3's CI design and the team rules (immutable action revisions, blocking checks, private evidence records).

## Files That Change

| File | Change |
|---|---|
| `scripts/verification/run-local-verification.ts` | Add the U4 database stage `database-notifications-import` after `database-directory`; U2's `database-identity` and U3's `database-directory` steps already run after the migrations and so re-check the rewritten U3 functions |
| `package.json` | New script `test:database:notifications-import`; the pinned xlsx library; `lint`, `format`, `format:check` lists extended with `src/import-parser/` |
| `scripts/db/shuffled-tests.ts` and its test | Every new U4 database test file is added to `DATABASE_TEST_FILES` so the shuffled run (NFR3.16) covers it |
| `scripts/verification/ci-config.test.ts` | Asserts the new stage key, its position (after `database-directory`, before `database-shuffled` and `coverage`) and the new package script |
| `scripts/verification/replaced-modules.test.ts` | Adds `src/notifications` and `src/import-migration` to the list of deleted demo modules (the deletion proof of NFR2.26) |
| `scripts/db/shuffled-tests.test.ts` | Its assertion that `DATABASE_TEST_FILES` equals the files of the `test:database:*` scripts is updated for the new script |
| `scripts/verification/lint-scope.test.ts` | Adds `src/import-parser/`; removes `src/notifications` and `src/import-migration` from the legacy allow-list when they are deleted |
| `next.config.ts` | The 6 MB server-action body limit |
| `.github/workflows/ci.yml` | No change expected; only the existing job timeout may be raised if the first full run shows the need |
| `tests/` | New database, adapter, parser, contract, component and browser tests |

## Stages

1. Install, static checks (type check, lint, format check) and scans (secret, privacy, dependency audit with high and critical blocking, SAST, no-deployment), as before; the audit covers the new library.
2. Start the stack with the same command.
3. Migrate and test: U1's database tests, U2's `database-identity` and U3's `database-directory` (re-run on the changed U3 functions), then U4's `database-notifications-import`: the role matrix per caller for the U4 tables and functions (NFR1.43 to NFR1.45, NFR1.51), staged-row privacy including a second super admin (NFR1.44), cross-organization isolation (NFR1.53), the history-leak search (NFR1.46), expiry with a controllable clock (NFR1.47), the commit tests (atomicity, re-match, idempotency, stale versions, no notices for imported assignments, jobs planned: NFR6.19 to NFR6.21, NFR6.26, NFR1.54), races (NFR3.14, NFR3.15), the tick tests (NFR6.22), the hand-off completeness test (NFR6.25), the data-set load test with 3000 notifications and 600 reminder jobs (NFR3.12), the audit-details shape test for `import.commit` (NFR1.55, NFR1.60), the per-use-case failure-injection tests including the rollback of U3 use cases when a notice write fails (NFR6.18), the index catalogue test comparing the indexes with the expected list (NFR3.13), the lifecycle cleanup (NFR1.56), the code-by-code contract test and the deletion proofs (NFR2.26), timings (NFR4.10 to NFR4.16), migration repeatability (NFR6.17), all also in the shuffled-order run (NFR3.16).
4. Parser and adapter tests: hostile workbook cases (NFR1.48), the path guard (NFR1.50), the output scan (NFR1.55, NFR1.59), the markup-injection test (NFR1.57), the upload size tests just under 5 MB and over 6 MB (NFR2.20), fake-client adapter tests (NFR6.23).
5. Production build, then the bundle scan proving the pinned xlsx library and the parser module are absent from client output (NFR1.49; it needs the build, like U2's `test:bundle`), then the start smoke. The real order in `run-local-verification.ts` is coverage, security scans, build, bundle, smoke, browser; the numbered list above groups them by purpose.
6. Browser and accessibility checks: the Hungarian copy and label checks for the new messages and the changed import controls (NFR5.7) and the import flow end to end (upload, a run with two conflicts, resolve, confirm, result, a second import, recovery), the notification list and the reminders list for a real parent and a real admin, each with the automated accessibility scan (NFR5.6, NFR6.24), and one reported timing of the preview (NFR4.10).
7. Coverage: at least 80% lines, branches and functions across all production source, measured after `src/notifications` and `src/import-migration` are deleted (NFR2.25).
8. Stop the stack (always), then the existing private evidence records.

## Stage to Gate Mapping

| Stage | Blocks merge when |
|---|---|
| Static checks and scans | Any finding, including a high or critical audit finding for the xlsx library |
| Start the stack | The stack is unhealthy or a published port is not loopback-only (U1) |
| Database tests | Any policy, catalogue, privilege, staged-data, atomicity, race, lock, tick, hand-off, contract, timing-ceiling test fails, or U2's or U3's suites fail after the changes |
| Parser and adapter tests | Any hostile-file, bundle, path-guard, output-scan or size test fails |
| Build and start smoke | The build or the smoke fails |
| Browser and accessibility | A failure or a serious or critical accessibility violation |
| Coverage | Below 80% lines, branches or functions on production source |

## Time Budget

The U4 database stage is estimated at under 12 minutes including the import timing tests, within the job's existing 45-minute timeout (raised only if the first full run shows otherwise); the large-workbook tests build their files in memory.

## Deployment Strategy, Rollback and Promotion

Not applicable: no deployment workflow exists. Rollback of a bad merge is a revert on `main`; local recovery is a reset (U1 NFR6.3).

## Secrets Management in CI

Unchanged: the stack's local defaults are not secrets, the session secret is generated per run, the service-role key is never printed, and actions stay pinned to immutable revisions.
