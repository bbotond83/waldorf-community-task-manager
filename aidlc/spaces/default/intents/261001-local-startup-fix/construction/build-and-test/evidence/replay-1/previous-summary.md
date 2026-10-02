# Local Startup Build and Test Summary

## Sources and Instruction Inventory

Source-complete inventory: current `../code-generation/code-generation-plan.md` Testing Contract, `../code-generation/unit-test-instructions.md`, `../code-generation/code-summary.md`, `../../inception/requirements-analysis/requirements.md`, and active-space team/project quality requirements. No Unit DAG, story ACs, NFR Requirements or NFR Design artifacts apply to this incremental scope. Generated instruction sets cover build, integration/browser/a11y, security and performance applicability. No measurable performance/load target applies.

## Final Readiness

All executed commands passed in this stage. The documented synthetic startup route passed on `bugfix/local-startup-fix`, including dev with process-local polling and production build/start without APP_RUNTIME_MODE export. This supports the bounded startup correction.

**Overall Build and Test result: unsuccessful / held.** T07 and T14 are Unverified. Per the stage's failure predicate, passing configured tests cannot turn those missing targets into a successful stage result. No deployment or merge readiness is claimed. No later scheduled validation stage owns either gap.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T01 | FR1 / NFR3 | Node 24/npm 11; enforcement retained | 24.21.0 / 11.19.0; toolchain and four cases pass | node-version.log, npm-version.log, toolchain.log, focused.log | Build and Test | Met |
| T02 | team Code Style / NFR3 | Formatter/linter pass | Both exit 0 | format.log, lint.log | Build and Test | Met |
| T03 | team Testing Posture / NFR3 | Strict typecheck pass | Exit 0 | typecheck.log | Build and Test | Met |
| T04 | FR2 / FR4 / NFR1 | Loading/toolchain regression and safe errors | 49 passed; existing readiness 18 passed separately | focused.log, runner.log | Build and Test | Met |
| T05 | Testing Contract scope floor | Existing suites green | 128 domain + 98 delivery passed; 0 failed/skipped | tests.log | Build and Test | Met |
| T06 | configured coverage gates | 80% lines/branches/functions in existing scopes | Domain 93.51/85.16/90.67%; runtime 94.59/95.34/91.30%; exit 0 | coverage.log | Build and Test | Met |
| T07 | team/project Testing Posture / NFR3 | 80% lines/branches/functions across all production source | Configured globs omit scripts/App Router; whole-source value unknown | vitest.config.ts; coverage.log | Build and Test | Unverified |
| T08 | FR3 / NFR3 | Production build pass | Exit 0 | build.log | Build and Test | Met |
| T09 | FR3 | Dev/start readiness without mode export | HTTP 200, ready/synthetic/waldorf-local-ready and root marker; polling used | acceptance.json, dev.log, start.log | Build and Test | Met |
| T10 | team Testing Posture / NFR3 | Start smoke pass | Exit 0 | smoke.log | Build and Test | Met |
| T11 | team Testing Posture / NFR3 | Critical browser flow pass | 96 passed, 0 failed/skipped | browser.log | Build and Test | Met |
| T12 | team Testing Posture / NFR3 | Zero serious/critical automated a11y violations | 15 passed, 0 failed/skipped; existing axe assertions passed | a11y.log | Build and Test | Met |
| T13 | project Mandated / NFR1 | Local privacy/secrets/SAST/no-deploy checks pass | All four exit 0 | privacy.log, secrets.log, sast.log, no-deploy.log | Build and Test | Met |
| T14 | team/project Testing Posture / NFR3 | Dependency audit blocks high/critical findings | Not executed: external registry prohibited | security-test-instructions.md | Build and Test | Unverified |
| T15 | NFR2 / constraints | Synthetic loopback, no external/deployment/global changes, cleanup | Sanitized env, no mode export, owned copy removed, zero remaining listeners | acceptance.json, listener-cleanup.json | Build and Test | Met |

## Evidence and Next Decision

Every log named in the matrix is under `evidence/`; source fingerprints bind the six changed application paths. Tests were executed once per distinct upstream command. Full suite totals are 226 unique test cases; readiness/focused/coverage repetitions are not added to that total. Browser96 and accessibility15 are separate runs with overlapping cases and are not summed as unique tests.

The dependency target cannot execute under the current zero-external constraint. Coverage instrumentation and tests can be extended through a fresh Code Generation plan, but this changes the approved measurement/test scope. Both requirements remain intact. The gated failure procedure asks the owner whether to retry a concrete fix, accept the recorded unsuccessful result, or stop.
