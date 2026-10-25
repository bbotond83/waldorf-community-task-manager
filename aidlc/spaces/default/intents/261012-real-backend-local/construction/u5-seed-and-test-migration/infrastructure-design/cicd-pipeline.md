# CI/CD Pipeline: U5 Seed and test migration

The existing workflow `.github/workflows/ci.yml` keeps its jobs; no deployment workflow is created or enabled. U5 removes synthetic mode from it and runs the data-exercising tests on the database. Source: the requirements of this unit, U1 to U4's CI design and the team rules (immutable action revisions, blocking checks, private evidence records).

## Files That Change

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | Both jobs: remove `APP_RUNTIME_MODE: synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION`. The Validate job keeps its stack steps and its time limit is raised from 45 to 90 minutes in this unit (not conditionally); one documented timing factor for a slower runner only if the first run shows the need. The SBOM and build evidence job (it rebuilds without a stack) sets build-only placeholder values for the database settings the production build now requires (an `https://app.example.invalid` address and non-secret dummy keys, as it already does for the public address), and its metadata step drops the mode and fixture fields |
| `scripts/verification/core.ts`, `scripts/verification/validate-manifests.ts`, `scripts/verification/aggregate-evidence.ts` and their tests | The evidence record fields `runtimeMode` (`synthetic` or `linked-target`) and `fixtureVersion` (`waldorf-local-v1`) lose their synthetic values: `runtimeMode` becomes `database` and `fixtureVersion` is dropped; the validators and tests follow |
| `scripts/verification/run-local-verification.ts` | The existing key order is kept (toolchain, manifests, format, lint, typecheck, tests, database-roles, database-migrate, database-stack, database-identity, database-directory, database-notifications-import, database-shuffled, coverage, security, build, bundle, smoke, browser); one key `database-seed` is inserted after `database-notifications-import` and before `database-shuffled`; the synthetic environment values in its child environment are removed |
| `scripts/verification/ci-config.test.ts` | Asserts the new key and its position, that `browser` stays last and after every database key, and that no synthetic setting remains in either job |
| `scripts/verification/replaced-modules.test.ts` and `lint-scope.test.ts` | Add the deleted folders (`src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`, `src/teacher-tracking`) and remove them from the legacy allow-list |
| `scripts/db/shuffled-tests.ts` and its test | New database test files are added to `DATABASE_TEST_FILES` so the shuffled run covers them |
| `package.json` | The three new scripts, a script for the seed tests, and the dependency updates |
| `playwright.config.ts` | One schema, port and server per browser, reset before each test file (see the specification) |

## Stages

The order is the script's existing one; the numbered list names what each step holds.

1. Static checks and stack-free tests: `toolchain`, `manifests`, `format`, `lint`, `typecheck`, `tests` (unit and component tests with the deletion tests: no synthetic name, route, cookie or setting exists in production source and every old route answers not found; they use test doubles, so they need no stack), `database-roles`. The stack is started by the workflow before the pipeline, as today.
2. Database phase: `database-migrate` (migrates the default schema and the worker schemas), `database-stack`, `database-identity`, `database-directory`, `database-notifications-import`, then the new `database-seed` (guard tests: hosted-looking, non-loopback and missing settings are refused and change nothing; seed repeatability; failed-seed rollback; reset cleanliness per schema; the audit purge, append-only and housekeeping tests; the output scan for passwords and personal values; the timing tests for seed, reset, the 30-family seed and the sign-in), then `database-shuffled` over all database test files. All of these use `worker_1` to `worker_4` and the default schema.
3. `coverage`: at least 80% lines, branches and functions across all production source, measured after the synthetic modules are deleted; it runs the stack-free suite, so it needs no reset schema.
4. `security`: secret, privacy, dependency audit with high and critical blocking, SAST, no-deployment; the audit passes after the first task of this unit.
5. `build`, `bundle` (extended: the seed module and the service-role key are absent from client output), `smoke`.
6. Browser phase (`browser`, last, after every database key has finished): the schemas `worker_1` to `worker_3` are reset and seeded before each test file by the shared helper; the migrated specs sign in for real and run the accessibility scan, one browser after another.
7. Stop the stack (always), then the existing private evidence records.

## Stage to Gate Mapping

| Stage | Blocks merge when |
|---|---|
| Static checks and stack-free tests | A format, lint or type finding, a removed name or route found by the deletion tests, or any test failing |
| Database phase | The stack is unhealthy, a published port is not loopback-only (U1), an earlier test fails, or a guard, seed, reset, purge, output-scan or timing-limit test fails |
| Coverage | Below 80% lines, branches or functions on production source |
| Scans | Any finding, including a high or critical audit finding |
| Build, bundle scan and start smoke | The build or the smoke fails, or a client bundle holds the seed module or a service key |
| Browser phase | A failure or a serious or critical accessibility violation |

## Time Budget

U1 to U4's database stages ran in about 12 minutes before U4; the new tests add a few minutes. The browser phase is estimated at 30 to 40 minutes for the full suite on one browser after another, and up to three times that for a failing file when CI retries twice (reported, never a failure by itself). Together with build, coverage and the stack-free tests this can pass the current 45 minutes, so the job limit is raised to 90 minutes in this unit.

## Deployment Strategy, Rollback and Promotion

Not applicable: no deployment workflow exists. Rollback of a bad merge is a revert on `main`; local recovery is `db:reset` followed by `db:seed`.

## Secrets Management in CI

Unchanged: the stack's local defaults are not secrets, the session secret is generated per run, the service-role key is never printed, the seed passwords are fictitious test values in a tracked file and are never printed, and actions stay pinned to immutable revisions.
