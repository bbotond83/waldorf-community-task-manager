# Local Startup Build and Test Results

## Execution

Run date: 2026-10-01T11:37:39.620651+00:00. Branch: `bugfix/local-startup-fix`. Existing Homebrew Node24.21.0/npm11.19.0 selected in the process environment only. No dependency install, browser download, registry request, external integration, production action or global shell change occurred.

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:coverage` all passed. The two distinct upstream commands were executed once: `npm run test:delivery -- tests/unit/runtime-boundaries.test.ts` (18 passed), and `npm run test:delivery -- tests/integration/runtime-config-cli.test.ts tests/unit/toolchain-validation.test.ts tests/unit/runtime-boundaries.test.ts` (49 passed). Full suites: 128 domain and 98 delivery, zero failures/skips. Coverage repeats the suites; it is not a new test count.

The temporary copy was built from current source and locally cloned installed dependencies; only `.env.example` supplied configuration. `npm run build`, `npm run smoke:start`, `npm run test:browser` (96 passed) and `npm run test:a11y` (15 passed) all exited 0. Dev/start reached the required readiness JSON and root marker without inherited NODE_ENV/APP_RUNTIME_MODE. Dev used the documented current-process polling fallback; native watcher behavior is not reclassified as a pass.

Privacy/secrets/SAST/no-deploy scans exited 0. Scoped test assertions preserve secret-safe validation and unsupported-toolchain errors. Evidence logs are captured command output with terminal color escapes removed, not summaries inferred from historical counts.

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

## Cleanup and Provenance

Owned server process groups were stopped and the disposable copy removed. Immediate bind probes on browser ports returned busy because closed TCP sockets can retain state; a subsequent connection probe and `lsof -sTCP:LISTEN` found no listeners. `evidence/listener-cleanup.json` records all five ports as not listening. No unrelated listener was killed. `evidence/source-fingerprints.json` records SHA256 for the six claimed paths. Other intents and the existing hook correction were preserved.

## Failure Diagnosis and Estimated Remedies

T07 is a pre-existing measurement gap: configured coverage excludes scripts/App Router; subprocess execution is absent from Vitest's parent coverage counters. An identifiable fix is to extend instrumentation and add tests for excluded production paths in a fresh Code Generation plan. Estimated effort: 1–3 engineering days after measurement; direct financial cost: $0 with installed tools; risk: medium due to broader test/instrumentation scope and subprocess/server boundaries. No defined threshold may be lowered. This estimate is provisional until the expanded measurement identifies uncovered paths.

T14 is a scope constraint, not a package-install failure. A registry-only `npm audit --audit-level=high` would produce the missing actual value, but requires an explicit exception to the zero-external boundary; it cannot be treated as already authorized. Estimated check effort: 5–15 minutes, direct cost $0, low execution risk; audit findings could require additional dependency fixes and fresh impact estimation. No production connection or deployment is part of that proposed exception.

No in-stage code fix was attempted: executed checks are green, coverage extension changes the approved Code Generation approach, and no flag can create trustworthy vulnerability evidence without a database. Loop-backs used: 0/3. Gated/unset autonomy requires the human's failure decision before any jump. The stage remains in-flight and learnings defer until a passing run or an explicit accepted-failure path.

## Loop-Back Log

### Loop-back 1 — 2026-10-01T11:39:33.899911+00:00

- Diagnosis: T07 whole-production-source coverage and T14 dependency audit remain Unverified despite all executed local checks passing.
- Root-cause stage: Code Generation measurement/test approach; dependency audit additionally requires an explicit scope exception.
- Planned fix: Extend instrumentation and regression coverage for excluded production paths while preserving all 80% floors; obtain a fresh target-bound plan approval. Do not contact the registry until the owner separately authorizes that exception.
- Estimated impact: 1–3 engineering days for broader instrumentation/test scope, $0 direct tool cost, medium risk. Registry audit itself is estimated at 5–15 minutes, $0, low execution risk; any findings require a new impact estimate.
- Human choice: -Retry with fix
