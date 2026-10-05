# Build and Test Results

## Identity and Execution
Revision85dab6b5c7762265357146a54e1612479e8c4302 plus the12 owned source hashes; see source-verification.json. Current stage executions on2026-10-05, Node 24.21.0/npm 11.19.0. Isolatedsnapshot preserves original development output/server.

| Command | StartUTC | FinishUTC | Exit | Evidence |
|---|---|---|---|---|
| npm exec -- playwright test --config playwright.login-existing.config.ts tests/browser/profile-login-existing.spec.ts --project=chrome | 2026-10-05T12:43:15.226Z | 2026-10-05T12:43:44.732Z | 0 | logs/existing.log |
| npm exec -- vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx tests/coverage/app-entrypoints.test.tsx | 2026-10-05T12:43:44.736Z | 2026-10-05T12:43:55.927Z | 0 | logs/scoped.log |
| npm run verify:local | 2026-10-05T12:43:55.927Z | 2026-10-05T12:46:06.390Z | 0 | logs/canonical.log |
| npm exec -- playwright test --config playwright.login-performance.config.ts tests/browser/profile-login-performance.spec.ts --project=chromium | 2026-10-05T12:46:06.392Z | 2026-10-05T12:46:46.520Z | 0 | logs/isolated.log |
| npm exec -- playwright test --config playwright.config.ts tests/browser/runtime-foundation.spec.ts tests/browser/parent-web.spec.ts tests/browser/staff-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --project=chromium | 2026-10-05T12:46:46.524Z | 2026-10-05T12:47:03.436Z | 0 | logs/critical.log |
| npm run test:a11y | 2026-10-05T12:47:03.437Z | 2026-10-05T12:47:19.493Z | 0 | logs/a11y.log |

## Results and Coverage
128 native domain tests;291 delivery; 419 coverage tests/44 files;56 scoped / 4 files;99full browser;15 axe. Scopedcritical test count is retained in logs; overlapping counts are not summed. No final failures, skips or retries. Production coverage 94.19lines/80.11branches/92.30functions%, all>=80%. Canonical33PASS/0FAIL/6OUTSTANDING.

## Target Verification Matrix
| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| LOGIN | NFR1 / plan Measurement Protocol | Every flow<=5000ms | 30 existing-server targets max 382.1 ms;20 isolated targets max 980.5 ms; original Chrome upper bounds2082–2345ms | existing-server-timings.json; isolated-timings.json; ../code-generation/native-chrome-after.md | Build and Test | Met |
| SESSION | NFR2 / FR4 | Session/origin/role/isolation checks pass | All preserved checks pass; signed/origin/role/history boundaries unchanged | logs/scoped.log; logs/critical.log; ../code-generation/quality-final/production-headers.json | Build and Test | Met |
| FORMAT | NFR3 | Formatter passes | Pass | logs/canonical-format.log | Build and Test | Met |
| LINT | NFR3 | Lint passes | Pass | logs/canonical-lint.log | Build and Test | Met |
| TYPES | NFR3 | Strict types pass | Pass | logs/canonical-typecheck.log | Build and Test | Met |
| TESTS | NFR3 | Existing tests green | 128 domain +291 delivery; 419 coverage tests;56 scoped pass | logs/canonical-tests.log; logs/canonical-coverage.log; logs/scoped.log | Build and Test | Met |
| LINES | NFR3 / Testing Contract | >=80% production lines | 94.19%;>=80% | logs/canonical-coverage.log | Build and Test | Met |
| BRANCHES | NFR3 / Testing Contract | >=80% production branches | 80.11%;>=80% | logs/canonical-coverage.log | Build and Test | Met |
| FUNCTIONS | NFR3 / Testing Contract | >=80% production functions | 92.30%;>=80% | logs/canonical-coverage.log | Build and Test | Met |
| BUILD | NFR3 | Production build passes | Pass | logs/canonical-build.log | Build and Test | Met |
| SMOKE | NFR3 | Deterministic start smoke passes | Pass:SMOKE_START_OK | logs/canonical-smoke.log | Build and Test | Met |
| BROWSER | NFR3 | Critical browser flows pass | 99 full suite pass; scoped critical flow pass | logs/canonical-browser.log; logs/critical.log | Build and Test | Met |
| A11Y | NFR3 | Zero serious/critical axe violations | 15 taggedflows pass; zero serious/critical violations | logs/a11y.log | Build and Test | Met |
| DEPENDENCIES | NFR3 | Zero high/critical vulnerabilities | 0 vulnerabilities | logs/canonical-security.log | Build and Test | Met |
| SAST | NFR3 | No high/critical findings | SAST_SCAN_PASS | logs/canonical-security.log | Build and Test | Met |
| SECRETS | NFR3 | Secrets/privacy/no-deploy pass | Privacy/secrets/no-deploy pass | logs/canonical-security.log | Build and Test | Met |

## Failure and Setup Accounting
Initial snapshot inventory found onlygenerated verification/reports and next-env.d.ts differences; excluded reportoutputs and copied current next-env.d.ts into owned copy. No application code changed. Firstsandbox Chrome launch failedSIGABRT/EPERM before flow execution:5cases failed, not passing acceptance. Preserved sandbox-existing.log and sandbox-results.json; raw browser JSON stays private tmp. Normal approval allowed identicalcommand rerun outside sandbox, then allsix commands passed. No source defect or upstream loop-back identified.

## Causal Evidence and Privacy
OriginalChrome baseline/postfix and conservativeall five bounds remain accepted source-bound ../code-generation/native-chrome-retry.md and native-chrome-after.md. Controlledtimingattachments sanitized into existing-server-timings.json/isolated-timings.json; every target/setup sample retained with submit elapsed, host observation / lower bound. No raw HAR, cookie/token/body or trace archive copied. Sourcehashes rechecked after runs.

## Outstanding External Evidence
Six existing linked-target/platform scenarios remain OUTSTANDING, outside this approvedlocalbugfix, not applicable targetsuccess or deferred evidence. No deployment readiness claim for realauth/RLS, scheduler/email,Vercel or Safari. Cross-unit traceability detailed FR/NFR 15/15 passes.
