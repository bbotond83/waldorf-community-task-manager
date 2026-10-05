# Build and Test summary

## Inputs and inventory

Source inventory: `../code-generation/code-generation-plan.md` (current Testing Contract), `unit-test-instructions.md`, `code-summary.md`, and `../../inception/requirements-analysis/requirements.md`. No separate NFR design/requirements artifacts or Unit DAG exist for this Minimal bugfix. Generated build, integration/browser, performance and security instructions because explicit NFRs require them.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1 | requirements.md / NFR1 | All20 individual samples <=5000ms | 20/20 required samples <=5000ms; maximum351.9ms | evidence/login-measurements.md | Build and Test | Met |
| NFR2 | requirements.md / NFR2; FR2 | Sessions, role isolation, denied access preserved | 38 focused tests,10 timing/isolation cases,96 existing browser tests pass | evidence/integration.log; evidence/browser.log; evidence/login-performance-report.json | Build and Test | Met |
| NFR3-COVERAGE | requirements.md / NFR3; code-generation-plan.md / Testing Contract | >=80% lines, branches, functions | Domain93.51/85.16/90.67%; delivery94.19/80.17/92.30% lines/branches/functions | evidence/coverage.log | Build and Test | Met |
| NFR3-BUILD | requirements.md / NFR3; Testing Contract | Build, startup smoke, typecheck pass | Build, typecheck and startup smoke exit0 | evidence/build.log; evidence/typecheck.log; evidence/smoke.log | Build and Test | Met |
| NFR3-STYLE | requirements.md / NFR3; Testing Contract | ESLint/Prettier pass | Lint and format exit0 | evidence/lint.log; evidence/format-check.log | Build and Test | Met |
| NFR3-TESTS | requirements.md / NFR3; Testing Contract | Existing and targeted tests pass | 128domain+411delivery+96existing browser+10performance cases pass;0fail0skip | evidence/coverage.log; evidence/browser.log; evidence/login-performance-report.json | Build and Test | Met |
| NFR3-A11Y | requirements.md / NFR3; Testing Contract | Zero serious/critical critical-flow violations | Critical flow3browser projects passed axe serious/critical gates | evidence/browser.log; focused critical flow9 passed15.6s | Build and Test | Met |
| NFR3-SECURITY | requirements.md / NFR3; Testing Contract | Scans pass; no high/critical vulnerability | All scans pass; dependency audit0vulnerabilities | evidence/verify-security.log | Build and Test | Met |

## Readiness and limitations

All executed commands passed and all applicable targets are Met for the defined local synthetic conditions. Build-ready and test-ready. Original issue resolution and deployed integration verification are not established. Deployment approval remains a later step. Original slowdown unreproduced; Code Generation review findings R-01, R-02, R-03 were accepted by the user. Production baseline metadata and generated next-env manifest discrepancy remain disclosed; no upstream artifacts edited in this stage.
