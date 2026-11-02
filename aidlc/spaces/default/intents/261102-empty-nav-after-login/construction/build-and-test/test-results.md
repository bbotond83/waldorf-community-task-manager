# Build and Test results

## Execution environment

macOS (Darwin 25.6.0), Node 24 from `/opt/homebrew/opt/node@24`, local Supabase stack, Chromium via Playwright. All results are from commands run in this stage; raw logs are in `evidence/`.

## Executed checks

| Check | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---|
| Domain tests (node test runner) | 511 | 0 | 0 | evidence/coverage.log |
| Delivery tests (Vitest, 126 files) | 1600 | 0 | 0 | evidence/coverage.log |
| Browser tests (Chromium, full suite) | 159 | 0 | 0 | evidence/browser.log |
| Typecheck, lint, format check | 3 | 0 | 0 | evidence/typecheck.log; evidence/lint.log; evidence/format-check.log |
| Production build and start smoke | 2 | 0 | 0 | evidence/build.log; evidence/smoke.log |
| Security scans and dependency audit | 1 | 0 | 0 | evidence/verify-security.log |

## Quality and coverage

Delivery coverage: statements 96.94%, branches 91%, functions 95.65%, lines 97.94%. Domain coverage: lines 99.39%, branches 94.34%, functions 97.30%. The 80% floors are unchanged. The dependency audit lists 16 moderate findings and none high or critical, so the blocking threshold is not reached.

## Regression proof

With only the two production lines restored to the old behaviour, 2 tests failed (the sign-in action redirect and the signed-in page redirect); with the fix, 36 of 36 passed (see `../code-generation/code-summary.md`).

## Retained concerns

Firefox and mobile-chrome were not run locally (CI covers them). Staging and production behaviour is not verified. See `build-and-test-summary.md` for the Target Verification Matrix.
