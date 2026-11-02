# Build and Test summary

## Inputs and inventory

Source inventory: `../code-generation/code-generation-plan.md` (Testing Contract: bugfix, Minimal, test-after), `unit-test-instructions.md`, `code-summary.md`, and `../../inception/requirements-analysis/requirements.md`. No Unit graph or user stories exist for this focused bugfix. All checks below were re-run in this stage; earlier counts in `code-summary.md` are superseded by them. Instruction files for integration, performance and security are short because the change adds no data access and no performance or privacy risk beyond the fixed-path redirect.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| FR1 | requirements.md / FR1, FR3 | Each role lands on its home with its menu (super admin 9, group admin 5, parent 3, teacher none) | 4 role-landing browser tests pass in Chromium | evidence/browser.log | Build and Test | Met |
| FR2 | requirements.md / FR2 | Signed-in visitor of the sign-in page is redirected to `/`; signed-out still sees the form | 3 sign-in page tests pass | evidence/coverage.log | Build and Test | Met |
| FR4-REGRESSION | requirements.md / FR4.1, FR4.2; Testing Contract scope floor | Two regression tests fail before the fix and pass after | 2 failed / 34 passed before; 36 of 36 passed after (Code Generation Step 11); both pass now | code-summary.md; evidence/coverage.log | Build and Test | Met |
| NFR1 | requirements.md / NFR1 | Fixed internal redirect target; no new data access | `redirect("/")` only; scans pass | evidence/verify-security.log | Build and Test | Met |
| NFR2-COVERAGE | requirements.md / NFR2; Testing Contract | At least 80% lines, branches, functions | Domain 99.39/94.34/97.30%; delivery 97.94/91/95.65% lines/branches/functions | evidence/coverage.log | Build and Test | Met |
| NFR2-BUILD | requirements.md / NFR2; Testing Contract | Typecheck, production build, start smoke pass | All exit 0 | evidence/typecheck.log; evidence/build.log; evidence/smoke.log | Build and Test | Met |
| NFR2-STYLE | requirements.md / NFR2 | ESLint and Prettier pass | Both exit 0 | evidence/lint.log; evidence/format-check.log | Build and Test | Met |
| NFR2-TESTS | requirements.md / NFR2; Testing Contract | Existing and new tests green | 511 domain + 1600 delivery + 159 Chromium browser tests; 0 failed, 0 skipped | evidence/coverage.log; evidence/browser.log | Build and Test | Met |
| NFR2-A11Y | requirements.md / NFR2; Testing Contract | No serious or critical accessibility violations on landing pages | Four role-landing scans pass | evidence/browser.log | Build and Test | Met |
| NFR2-SECURITY | Testing Contract | Scans pass; no high or critical dependency finding | Scans pass; audit reports 16 moderate, 0 high or critical | evidence/verify-security.log | Build and Test | Met |
| NFR2-CROSS-BROWSER | Testing Contract | Critical flow in every browser | Chromium only here; Firefox and mobile-chrome not run locally | (CI runs all browsers) | CI Pipeline | Unverified |
| NFR3 | requirements.md / NFR3 | Hungarian user-facing text, English identifiers | Removed copy only; no new user text; lint and tests pass | evidence/lint.log | Build and Test | Met |

## Readiness and limitations

Build-ready and test-ready for local conditions. Firefox and mobile-chrome browser projects were not run locally and stay unverified until CI runs them on the pull request. Deployed (staging or production) behaviour is not verified. The "Nincs jogosultság" page still has no sign-out button (architecture review follow-up, out of scope).
