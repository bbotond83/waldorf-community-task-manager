# Local Startup Build and Test — Passing Replay

## Sources and Instruction Inventory

Source-complete inventory: current `../code-generation/code-generation-plan.md` Testing Contract, `../code-generation/unit-test-instructions.md`, `../code-generation/code-summary.md`, `../../inception/requirements-analysis/requirements.md`, and active team/project quality rules. No Unit DAG/story AC/NFR Requirements/NFR Design artifacts exist for this zero-Unit bugfix. No numerical performance target applies.

Instruction sets cover build, upstream functional/measurement commands, integration/browser/a11y, security and performance applicability. Upstream Code Generation outputs remained frozen and all23 source hashes were rechecked.

## Final Readiness

**Overall result: successful. All15 applicable targets are Met; no Pending/Not Met/Unverified target remains.** All acceptance commands and expectation-check wrappers passed. The three declared negative subset-measurement probes returned their required raw exit1 with every selected test passing, valid complete maps and only the documented global-floor diagnostic. They are verified negative checks, never T07 evidence. Complete explicit and canonical coverage commands separately exited0 at unchanged floors.

The default documented synthetic dev/build/start route passes with process-local Homebrew PATH and documented polling. Dependency audit used the user-authorized npm registry exception; no automatic fixes, production integration, deployment or global shell edit occurred. This stage supports local build/test readiness, not a deployment claim.

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

## Evidence and Limits

All current evidence is under evidence/replay-1/ with a SHA256 index. Native/delivery unique suite totals are399; scoped/coverage repeats are not summed. Browser96 and accessibility15 are separate overlapping runs. All runtime candidates are covered by the complete map;17 zero-runtime declarations/barrels and CSS are transparently inventoried. Linked production integrations and Safari remain outside this authorized task. The prior failed run and its append-only Loop-Back Log remain preserved.
