# Test Results: Real local backend

Run date: 2026-10-25. Commit: `4ccf6f3acfd701f012797852d9c9d045c5024eff` (branch `chore/workflow-records-code-generation-rerun`, which only adds workflow records on top of `main` at `757092f`). Machine: the owner's Mac mini, Node 24, npm 11, Docker Desktop with the local Supabase stack running. Command: `npm run verify:local` with the stack settings loaded. Logs: `.verification/logs/<stage>.log` (git-ignored).

A first run stopped at the build stage because the terminal had no stack settings loaded (`CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET`): an environment-setup matter of this stage, fixed by loading `.env.database.local` and `.env.service.local` and giving a random session secret, as `README.md` and `build-instructions.md` say. The second run passed.

## Result

`LOCAL_VERIFICATION_PASS`; evidence report: 33 PASS, 0 FAIL, 6 OUTSTANDING (the six hosted-target items below).

## Build

| Step | Result |
|---|---|
| Toolchain (Node 24 / npm 11) | pass |
| Manifests | pass |
| Format, lint (0 warnings), typecheck | pass |
| `npm run build` | pass |
| Client bundle scan (`test:bundle`) | pass: no seed module and no service-role key in browser output |
| Start smoke (`smoke:start`) | pass: readiness route up, old synthetic routes answer 404 |

## Tests

| Suite | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Vitest (component, page, integration) | 834 (59 files) | 834 | 0 | 0 |
| Node runner, domain and script tests | 508 + 228 | 736 | 0 | 0 |
| Role migration (disposable PostgreSQL 18) | 9 | 9 | 0 | 0 |
| Database, platform (`test:database:stack`) | 114 | 114 | 0 | 0 |
| Database, identity | 330 | 330 | 0 | 0 |
| Database, directory and coordination | 352 | 352 | 0 | 0 |
| Database, notifications and import | 258 | 258 | 0 | 0 |
| Database, seed, reset, audit purge, timing | 53 | 53 | 0 | 0 |
| Database, shuffled order (all database files) | 1107 | 1107 | 0 | 0 |
| Browser (chromium, firefox, mobile-chrome) | 465 | 427 | 0 | 38 (skipped by design in the specs) |

One flaky test was seen outside `verify:local` (reviewers' own runs): `tests/integration/swap-screens.test.tsx` failed once in the first full `npm test` of the U3 review, and passed on the next full run and in three isolated runs. It did not fail in this run. It is recorded as a known flaky test (follow-up plan, group C).

## Coverage

| Measure | Actual | Target |
|---|---|---|
| Statements | 97.17% (5198/5349) | at least 80% |
| Branches | 91.01% (4011/4407) | at least 80% |
| Functions | 96.41% (1209/1254) | at least 80% |
| Lines | 98.09% (4626/4716) | at least 80% |

## Measured performance (local)

| Target | Limit | Measured |
|---|---|---|
| Small seed | 60 s | 0.23 s |
| Reset | 30 s | 0.03 s |
| 30-family seed | 120 s | 0.67 s |
| Sign-in on seeded data (database level) | 5000 ms | 76 ms |
| 2000-row workbook preview and commit | 60 s | 2.5 s in the notifications stage; 24.2 s in the shuffled run (load) |
| Privacy and secret scans together | 15 s | 0.3 s each |

## Security and privacy

| Check | Result |
|---|---|
| `scan:privacy` (1211 files in the security stage, 1257 in the final run) | pass |
| `scan:secrets` | pass |
| `scan:sast` | pass |
| `verify:no-deploy` | pass |
| `npm audit --audit-level=high` | exit 0: 5 moderate, no high or critical (nodemailer chain 3 advisories, vitest mocker chain 2 advisories) |
| Axe accessibility scan on the critical flows, three browsers | no serious or critical violation |

## Outstanding (not exercised, by design)

Six items need a hosted or linked target and stay reported as outstanding evidence: Safari desktop smoke, Safari mobile smoke, Supabase auth and row-level-security on a linked target, Supabase persistence on a linked target, the scheduler provider, and the Vercel preview/staging deployment.

## Notes on the verification run

- `npm run verify:local` rewrites three report files that U5 claims (`verification/reports/local-acceptance.json`, `local-acceptance.md`, `outstanding-targets.md`). They were restored with `git restore` afterwards so U5's approval stays intact; only the commit hash and timestamps differ. Commit refreshed reports with the next change to those files.

## Loop-Back Log

None. No build or test command failed on the final run.
