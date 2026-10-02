# Local Startup Build and Test Results

## Current Replay Execution

Verified at 2026-10-01T14:11:49.621728+00:00 on bugfix/local-startup-fix with process-local Node24.21.0/npm11.19.0. Each distinct upstream functional/coverage command executed once; coverage commands serialized. Explicit npm_execpath satisfies direct-node prehook prerequisites. Every acceptance command exited0. Three negative coverage-probe child commands exited1 as expected; their wrappers asserted passed tests, the unchanged global-floor rejection, complete maps and nonnegative counters. Raw exits and logs remain visible.

Full tests128 native+271 delivery=399; startup49, support9, application117, boundaries47. Full explicit and canonical instrumented runs each pass399; these are repeated cases, not extra tests. Browser96/a11y15 pass. Build/dev/start/smoke and local scans pass; actual final-lock audit has zero vulnerabilities.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T01 | requirements.md FR1/NFR3 | Node24/npm11; unsupported versions rejected | 24.21.0/11.19.0; toolchain/regressions pass | evidence/replay-1/node-version.log,npm-version.log,toolchain.log,startup.log | Build and Test | Met |
| T02 | Testing Contract team Code Style | Formatter/linter pass including ignored owned files | All exit0 | evidence/replay-1/format.log,owned-format.log,lint.log | Build and Test | Met |
| T03 | Testing Contract team Testing Posture | Strict typecheck pass | Exit0 | evidence/replay-1/typecheck.log | Build and Test | Met |
| T04 | requirements.md FR2/FR4/NFR1 | Loading/precedence/rejection/redaction regressions pass | 49 passed | evidence/replay-1/startup.log | Build and Test | Met |
| T05 | Testing Contract scope floor | Existing and new suites green | 128 native +271 delivery=399;0 failed/skipped | evidence/replay-1/tests.log | Build and Test | Met |
| T06 | current coverage config / Testing Contract | Native and full-instrumented configured gates pass | Both exit0; native93.51/85.16/90.67 | evidence/replay-1/canonical-coverage.log,explicit-coverage.log | Build and Test | Met |
| T07 | requirements.md NFR3 / Testing Contract team/project | 80% lines/branches/functions across complete production scope | 94.18% lines1781/1891;80.14% branches1465/1828;92.30% functions624/676;124 runtime files/141 candidates | evidence/replay-1/canonical-coverage-map.json,canonical-coverage-inventory.json,canonical-coverage-summary.json | Build and Test | Met |
| T08 | requirements.md FR3/NFR3 | Production build pass | Exit0 | evidence/replay-1/build.log | Build and Test | Met |
| T09 | requirements.md FR3 | Dev/start synthetic readiness/root without mode export | HTTP200 ready/synthetic/waldorf-local-ready and root marker;documented polling | evidence/replay-1/acceptance.json,dev.log,start.log | Build and Test | Met |
| T10 | Testing Contract team Testing Posture | Deterministic start smoke pass | Exit0 | evidence/replay-1/smoke.log | Build and Test | Met |
| T11 | Testing Contract team Testing Posture | Critical browser flow passes | 96 passed;0 failed/skipped | evidence/replay-1/browser.log,browser-accessibility-results.json | Build and Test | Met |
| T12 | Testing Contract team Testing Posture | Zero serious/critical automated a11y violations | 15 passed;0 failed/skipped;existing axe assertions pass | evidence/replay-1/a11y.log | Build and Test | Met |
| T13 | requirements.md NFR1 / project Mandated | Privacy/secrets/SAST/no-deploy scans pass | All four exit0 | evidence/replay-1/privacy.log,secrets.log,sast.log,no-deploy.log | Build and Test | Met |
| T14 | requirements.md NFR3 / Testing Contract team/project | No high/critical dependency findings | Audit exit0;zero vulnerabilities;541 dependencies;final lock hash verified | evidence/replay-1/audit.log,audited-lock-sha256.txt | Build and Test | Met |
| T15 | requirements.md NFR2/Constraints + Package + audit | Synthetic loopback and authorized npm registry only;cleanup;no production/deploy/global changes | 23 source hashes match copy;owned copy removed;7 ports have no listeners | evidence/replay-1/acceptance-source-binding.json,cleanup.json,checks.json | Build and Test | Met |

## Provenance and Cleanup

All23 application/test/config hashes match the approved manifest and acceptance copy. The contributor .env.local was never copied or read; only synthetic .env.example-derived configuration was used. No APP_RUNTIME_MODE/NODE_ENV export was provided to dev/start. Installed-browser/cache escalation was already authorized; no download occurred. Owned copy removed; seven ports confirmed not listening. No unrelated process was killed. Current instruction sets specify npm registry scope explicitly.

## Prior Failed Run

Historical evidence and original matrix: evidence/replay-1/previous-test-results.md and previous-summary.md. Its T07/T14 gaps are closed by current full-scope instrumentation/tests and the authorized real registry audit. No new loop-back was necessary;one of three loop-backs was used.

## Loop-Back Log

### Loop-back 1 — 2026-10-01T11:39:33.899911+00:00

- Diagnosis: T07 whole-production-source coverage and T14 dependency audit remain Unverified despite all executed local checks passing.
- Root-cause stage: Code Generation measurement/test approach; dependency audit additionally requires an explicit scope exception.
- Planned fix: Extend instrumentation and regression coverage for excluded production paths while preserving all 80% floors; obtain a fresh target-bound plan approval. Do not contact the registry until the owner separately authorizes that exception.
- Estimated impact: 1–3 engineering days for broader instrumentation/test scope, $0 direct tool cost, medium risk. Registry audit itself is estimated at 5–15 minutes, $0, low execution risk; any findings require a new impact estimate.
- Human choice: -Retry with fix
