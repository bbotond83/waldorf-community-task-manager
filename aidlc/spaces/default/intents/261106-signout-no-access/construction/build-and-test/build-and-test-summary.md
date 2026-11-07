# Build and Test Summary

## Overall status

Build succeeds. All executed checks pass. Test strategy: Minimal (express scope). Prerequisites: Node 24, Docker, the local stack's settings in the environment (see `build-instructions.md`).

## Test type inventory

- Unit/delivery: one new regression test in `tests/coverage/app-entrypoints.test.tsx`.
- Browser: `tests/browser/no-access.spec.ts` (accessibility scan and sign-out flow).
- Integration, performance, security instruction files exist; performance is N/A, security uses the project's existing scans.

## Coverage expectations

Whole-project floor 80% for lines, branches and functions (`vitest.config.ts`). Actual: lines 97.92%, branches 91.09%, functions 95.66%.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| T1-existing-suite-green | code-generation-plan.md, Testing Contract (scope floor) | existing suite green | 901 of 901 delivery tests pass; domain and scripts suites pass | test-results.md, Tests | build-and-test | Met |
| T2-coverage-floor | team.md Testing Posture; vitest.config.ts | at least 80% lines, branches, functions | 97.92 / 91.09 / 95.66 (delivery); 99.39 / 94.32 / 97.30 (domain) | test-results.md, Coverage | build-and-test | Met |
| T3-strict-typecheck | team.md Testing Posture | `npm run typecheck` exit 0 | exit 0 | test-results.md, Build | build-and-test | Met |
| T4-format-lint | team.md Code Style | Prettier, ESLint, Stylelint pass | all pass | test-results.md, Static checks | build-and-test | Met |
| T5-production-build | team.md Testing Posture | `npm run build` exit 0 | exit 0 | test-results.md, Build | build-and-test | Met |
| T6-accessibility (NFR1) | requirements.md NFR1 | no serious or critical axe violations on the page | 0 violations; test passed | tests/browser/no-access.spec.ts, Chromium 2 of 2 | build-and-test | Met |
| T7-regression (NFR4) | requirements.md NFR4 | test fails before, passes after the change | failed before (no sign-out button), passes after | test-results.md, Regression proof | build-and-test | Met |
| T8-dependency-scan | project.md Testing Posture | no high or critical findings | 0 high or critical (8 moderate) | `npm audit --audit-level=high` exit 0 | build-and-test | Met |
| T9-ci-before-merge | org.md / team.md CI obligation | CI runs the tests before merge | not applicable | the plan runs no CI Pipeline (`ci-pipeline` is SKIP) | n/a | N/A |

## Readiness

- Build-ready: yes.
- Test-ready: yes for the executed scope.
- Deployment-ready: not assessed here; Deployment Pipeline is the next stage and nothing deploys automatically today.

## Known limitations

- Firefox, mobile-chrome and the other existing browser specs were not run here.
- Start smoke test not run.
- The exact sign-in path that sends a person to the standalone page was not found; the fix covers the page itself.
- The local stack ran with `DB_ALLOW_ALL_INTERFACES=1` (owner's instruction) for the browser run and was stopped afterwards.
