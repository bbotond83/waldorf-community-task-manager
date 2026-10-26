# Build and Test Summary: Real local backend

## Overall status

Build ready, test ready. `npm run verify:local` passed on the final run: 33 PASS, 0 FAIL, 6 OUTSTANDING (hosted-target items, outside this intent). Details are in `test-results.md`. Deployment is out of scope: the team's rules keep executable deployment workflows disabled until a deployable app and a linked target exist.

One finding is surfaced for the approval gate: the cross-unit traceability check fails on bookkeeping, not on code (see `cross-unit-traceability.md`).

## Test type inventory

Strategy: Comprehensive, methodology test-after.

| Type | Where | Instruction file |
|---|---|---|
| Build, type check, lint, format | `npm run build`, `typecheck`, `lint`, `format:check` | `build-instructions.md` |
| Unit and component tests | 834 Vitest + 736 Node runner tests, colocated `*.test.ts` | per-unit `unit-test-instructions.md` |
| Database integration tests on the real local stack | 1107 tests in five suites plus the 9-test role migration | `integration-test-instructions.md` |
| Browser journeys and accessibility, three browsers | 465 tests (427 pass, 38 skipped by design) | `integration-test-instructions.md` |
| Performance (local) | timing tests in the seed, directory and notifications suites | `performance-test-instructions.md` |
| Security and privacy | scans, audit, role/RLS tests, bundle scan, guard tests | `security-test-instructions.md` |

## Coverage expectations

Repository-wide at least 80% statements, branches and functions. Actual: 97.17% statements, 91.01% branches, 96.41% functions, 98.09% lines. Per-unit expectations are in each unit's `unit-test-instructions.md`.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage | team.md Testing Posture; NFR2 | at least 80% lines, branches and functions across all production source | 98.09% lines, 91.01% branches, 96.41% functions | `.verification/logs/coverage.log` (`npm run test:coverage`) | build-and-test | Met |
| T2-NFR2-gates | requirements NFR2; team.md | type check, lint, format, unit, component, database, browser tests and production build pass | all exit 0; 834 + 736 + 1107 + 9 tests pass, 427 browser pass | `test-results.md`; `LOCAL_VERIFICATION_PASS` | build-and-test | Met |
| T3-NFR2-axe | requirements NFR2; team.md critical browser flow | no serious or critical axe violation | 0 on chromium, firefox, mobile-chrome | `browser.log` (`@a11y` tests) | build-and-test | Met |
| T4-NFR3-isolation | requirements NFR3 | tests independent of each other and of run order; seed deterministic | shuffled run of all database files passes (1107); seeding twice equals one seed | `database-shuffled.log`, `tests/database/seed.test.ts` | build-and-test | Met |
| T5-NFR4-seed-reset | requirements NFR4 | small seed within 60 s, reset within 30 s | 0.23 s and 0.03 s (30-family seed 0.67 s of 120 s) | `database-seed.log` timing lines | build-and-test | Met |
| T6-NFR4-signin | requirements NFR4 | sign-in within 5000 ms | 76 ms at database level; browser sign-in timing spec passes | `database-seed.log`, `tests/browser/sign-in-timing.spec.ts` in `browser.log` | build-and-test | Met |
| T7-NFR4-unit-timings | unit NFR4 targets (U1 to U4) | import of 2000 rows within 60 s; directory and platform timings within their limits | 2.5 s (24.2 s under shuffled load); directory, audit (under 50 ms) and scan (0.3 s of 15 s) targets met | `database-notifications-import.log`, `database-directory.log`, `security.log` | build-and-test | Met |
| T8-NFR5-a11y-screens | requirements NFR5 | sign-in, invitation and reset screens meet WCAG 2.2 AA and are Hungarian | axe clean; contrast and keyboard checks pass; copy tests pass | `browser.log`, `tests/integration/copy.test.ts`, `tests/unit/design-tokens.test.ts` | build-and-test | Met |
| T9-NFR6-repeatable | requirements NFR6 | migrations repeatable on a fresh database; failed import or seed leaves no partial data | repeatability test on every schema passes; injected-failure tests for seed and import pass | `tests/database/migrations.test.ts`, `seed.test.ts`, `import-commit.test.ts` | build-and-test | Met |
| T10-NFR1-privacy | requirements NFR1 | other parents' contact details unreadable by database rules; passwords never logged; service-role key not in the browser; seed only local; no real personal data committed | role/RLS tests, output scans and bundle scan pass; privacy scan finds no real data | `identity-grants/probe` tests, `seed.test.ts` output scan, `test:bundle`, `PRIVACY_SCAN_PASS` | build-and-test | Met |
| T11-NFR7-no-regression | requirements NFR7 | other screens keep markup, copy, test ids and behaviour | migrated browser specs assert the same copy and test ids; all pass | `browser.log` | build-and-test | Met |
| T12-NFR8-language | requirements NFR8 | user-facing words Hungarian; code, schema, tests, technical docs English | copy tests pass; no English user-facing strings flagged by the copy tests | `tests/integration/copy.test.ts` | build-and-test | Met |
| T13-dependency-scan | project.md; team.md | no high or critical dependency findings | 0 high or critical; 5 moderate | `npm audit --audit-level=high` in `security.log` | build-and-test | Met |
| T14-secret-and-SAST | team.md Code Style | no secrets; no high or critical SAST | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS`, `NO-DEPLOY_SCAN_PASS` | build-and-test | Met |
| T15-start-smoke | team.md Testing Posture | deterministic start smoke | pass | `smoke.log` | build-and-test | Met |
| T16-hosted-targets | team.md: provisioned integrations count as verified only when exercised against real targets; NFR2 | n/a: this intent provisions no hosted integration; all work runs on the local stack | six hosted-target checks stay reported as outstanding evidence | `verification/reports/outstanding-targets.md` | none scheduled | N/A |
| T17-CI-obligation | Testing Contract: run the selected tests in CI before merge | n/a: the plan runs no CI Pipeline stage; CI itself already runs these checks in `.github/workflows/ci.yml` and passed on the U5 pull request | recorded | plan | n/a | N/A |

Per-unit NFR identifiers (NFR1.x to NFR8.x of each unit) are traced in `cross-unit-traceability.md`.

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope; no deployable target is linked).

## Known limitations and outstanding items

- Hosted-target checks stay outstanding (T16): Safari desktop and mobile, Supabase auth and row-level security on a linked target, Supabase persistence on a linked target, scheduler provider, Vercel preview and staging.
- Cross-unit traceability fails on recording gaps (see `cross-unit-traceability.md`): six requirement ids that U5 built are missing from U5's `traceability.json`, and several targets in U2, U3 and U5 list more than one file in a single field.
- One open Major from the Code Generation reviews: the stack's network-exposure check probes IPv4 only. Planned in `follow-ups/minor-findings-plan.md`, group A.
- Known load-sensitive tests: the 2000-row import timing ceiling and `swap-screens.test.tsx` (follow-up plan, group C).
- `HASZNALATI_UTMUTATO_HU.md` and the seeded accounts have not been walked through by the owner in a browser by hand; the automated browser phase covers the same journeys.
- The real workbook remains in git history until the owner rewrites history.
- `verify:local` rewrites three report files that U5 claims; they were restored to keep U5's approval. Refresh them with the next commit that touches U5's files.
