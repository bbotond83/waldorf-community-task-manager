# Local Startup Fix Code Summary

## Current Result — Authorized Istanbul Amendment

**All ten Code Generation plan steps are executed; no implementation/tooling blocker remains.** The current results below supersede the historical startup/V8 measurement limits retained later in this document. The conductor owns review and lifecycle completion.

All changes remain on `bugfix/local-startup-fix`. The user authorized Package + audit; the original Approve Plan receipt and Testing Contract were preserved under the relaxed fence. The exact registry install added `@vitest/coverage-istanbul4.1.11` and necessary `@istanbuljs/schema0.1.6`; existing V8 remains installed and existing startup scripts/declarations were retained. No unrelated locked package version changed. Current package/lock SHA-256 values match the conductor's final audit provenance: `8687af62e2b6cac3fa484572eb31e06db7a051ee90c79c20f80bd71bb763fb6b` / `76c8d07b35e4faa7f5f1f8da1f80bf5a82f7b0370ad9edaca93184b6187b1886`.

The amendment changed package.json/package-lock.json, switched vitest.config.ts to Istanbul, and added meaningful malformed-manifest/evidence/duplicate-identifier and staff-filter denial/query cases inside the approved verification-entrypoints/staff-pages test files. The cumulative manifest lists23 actual application/test/config paths with current hashes. README, runtime validator and the two original startup regression files retain their prior hashes byte-identically. No production behavior was refactored for coverage.

### Current Measurements and Verification

| Gate | Actual final result |
|---|---|
| Full production lines | **94.18%**,1781/1891 |
| Full production branches | **80.14%**,1465/1828 |
| Full production functions | **92.30%**,624/676 |
| Canonical `npm run test:coverage` | Exit0; native gate and full delivery/domain instrumentation passed |
| Explicit delivery+domain coverage selectors | Exit0;399 assertions, same unchanged floors/integrity |
| Inventory/completeness |141 candidates;124 runtime-bearing measured,13 linkage-only,4 type-only; local linkage dependencies accounted for |
| Native/adapted domain |128 each; exact case-name multisets match |
| `npm test` |128 native +271 delivery =399 passed |
| Scoped support/application/boundaries/startup |9 /117 /47 /49 passed |
| Toolchain/format/explicit owned-format/lint/typecheck | All exit0; Node24.21.0/npm11.19.0 selected process-locally |
| Current-source isolated build/start/dev/smoke | All passed; start3511/dev3512 readiness and root marker, smoke3513 |
| Installed-browser / accessibility acceptance |96 /15 passed after sandbox escalation; no downloaded assets |
| Privacy/secrets/SAST/no-deploy | All exit0 in isolated current-source copy |
| Final-lock npm-registry audit | Conductor's exit0;zero vulnerabilities,541 dependencies; no fixes |

T07 now has a valid complete executable denominator and all80/80/80 floors. T14 is measured by separate final-lock audit evidence. CSS remains separately inventoried; JavaScript counters do not measure CSS. Type-only/linkage-only classification comes from syntax and dependency accounting, never from excluding uncovered runtime files. Child/browser runs are behavior evidence and receive no parent coverage credit. Installed Istanbul's actual CoverageMap callback and raw counters passed the existing strict integrity reporter, including the former admin-action reproduction28 cases without negative counters.

### Preserved Failures and Corrections

The first full Istanbul measurement had a valid map but failed the branch floor: lines93.49%, branches78.88%, functions92.30%. Its direct-node invocation also lacked `npm_execpath`, causing12 retained startup prehook assertions to fail. The earlier progress claim that all375 assertions passed was incorrect: that attempt had363 passes/12 prerequisite failures. Intermediate maps reached79.92% and79.97% branches; one malformed-story fixture initially reached the earlier incomplete guard, corrected by substituting a nonrequired story. These failure logs remain durable.

The direct-node complete instruction now states the process-local installed npm CLI prerequisite; npm-script commands supply it automatically. Concurrent coverage invocations collided on shared `coverage/.tmp`, producing ENOENT; both complete gates were rerun sequentially and passed. No provider counters were altered or ignored. The initial installation hit sandbox npm-cache EPERM; the required authorized escalated retry succeeded. The initial acceptance-copy exclusion accidentally omitted tests/coverage and failed build type resolution; a fresh root-only exclusion copy included all23 manifest paths, verified byte-for-byte before cleanup, and passed build.

Browser/a11y initial attempts failed at existing Firefox automation-metadata cache access (sandbox EPERM), followed by authorized offline escalated passes. Dev used the already-documented process-local WATCHPACK_POLLING=true. These harness/platform failures remain distinct from production assertions. All historical V8 negative raw maps, transform investigations and previous audit evidence remain immutable.

### Durable Evidence, Cleanup and Limits

[evidence/coverage-retry/index.json](evidence/coverage-retry/index.json) lists every exact durable evidence filename, byte count and SHA-256. Current key evidence includes `istanbul-provider-install.json`, `istanbul-initial-full.log`/`istanbul-initial-full-map.json`, `istanbul-canonical-serialized.log`/`istanbul-final-canonical-map.json`, `istanbul-explicit-serialized-final.log`/`istanbul-final-explicit-map.json`, `istanbul-final-inventory.json`, `istanbul-final-summary.json`, `istanbul-final-gaps.json`, `istanbul-final-results.json`, `istanbul-adapter-comparison.json`, `istanbul-final-tests.log`, `istanbul-startup-final.log`, `istanbul-application-final.log`, `istanbul-boundaries-complete.log`, all `istanbul-*` quality/acceptance logs, `istanbul-acceptance-source-binding.json`, `istanbul-acceptance-results.json`, and `istanbul-cleanup.json`. Failed initial/midpoint/collision logs are included too.

Audit provenance remains distinct: `npm-audit-before-provider.json` covers the539-dependency pre-install lock; `npm-audit-after-provider.json` and `npm-audit-after-provider-provenance.json` cover the final541-dependency lock. No automatic fixes or production integration calls occurred. The conductor owns force-tracking ignored test/log paths and final review; the manifest includes every actual source path regardless of ignore state.

Both owned disposable acceptance copies were removed; owned start/dev/smoke/browser/a11y listeners were stopped and nine ports3511–3513,3520–3522,3530–3532 verified free. Contributor env files were neither read nor copied; acceptance used invented synthetic .env.local and no APP_RUNTIME_MODE/NODE_ENV exports. No global settings changed. Linked production integrations and Safari remain unexercised; existing synthetic success does not verify those targets. Branch coverage clears the affirmed global floor narrowly, with genuine uncovered ranges retained for future work.

## Historical Evidence — Original Provenance Retained

Everything below describes earlier checkpoints; its outstanding coverage/audit statements are historical and superseded by the current measured results above.


## Historical Initial Startup Implementation

All application changes are on `bugfix/local-startup-fix`.

| File | Result |
|---|---|
| README.md | nvm and existing Homebrew routes, Node/npm verification, guarded synthetic env-file setup, mode/precedence explanation, dev/build/start readiness, process-local watcher polling fallback |
| package.json | Three command-specific prehook arguments and direct @next/env 16.3.6 ownership |
| package-lock.json | Matching root dependency declaration; existing locked loader retained, no dependency refresh/install |
| scripts/validate-runtime-config.ts | Next env loading before pure schema validation, explicit NODE_ENV precedence, production standalone default, redacted fail-closed loader errors |
| tests/integration/runtime-config-cli.test.ts | 27 isolated CLI/prehook regressions for selection, ordering, overrides, missing/invalid values, expansion, test exclusions and redaction |
| tests/unit/toolchain-validation.test.ts | Four supported/unsupported/missing-metadata toolchain cases using an isolated mock process |

The pure runtime schema/result states and toolchain enforcement are preserved. A default import handles @next/env's CommonJS packaging. The loader logger captures failure without exposing its raw arguments; file/parser failures produce only `CONFIG_ENV_LOAD_FAILED: invalid environment file`. Schema failures retain their existing code/variable-only output.

No domain, delivery contract, production composition or deployment behavior changed. Other intents' records, the existing framework hook repair and unrelated working-tree edits were preserved.

## Commands and Results

Tools actually used: Node `v24.21.0`, npm `11.19.0`, selected with current-process PATH only.

| Check | Baseline | Final |
|---|---|---|
| npm run check:toolchain | PASS | PASS in isolated application |
| npm run format:check | PASS | PASS |
| npm run lint | PASS | PASS |
| npm run typecheck | PASS | PASS after correcting Next's NODE_ENV type incompatibility |
| npm test | 128 domain + 67 delivery passed | 128 domain + 98 delivery passed |
| npm run test:coverage | PASS | PASS with unchanged thresholds |
| Scoped existing runtime-boundary readiness | 18 passed | Included in focused run |
| Focused regressions | New files absent before implementation | 49 passed across three files |
| Isolated npm run build | Not a baseline obligation | PASS |
| Isolated npm run dev / npm run start | Not run before implementation | Synthetic readiness and root marker verified |
| Isolated npm run smoke:start | Not run before implementation | PASS |
| Isolated npm run test:browser | Initial sandbox attempt unavailable | 96 passed after approved offline escalation |
| Isolated npm run test:a11y | Initial sandbox attempt unavailable | 15 passed after approved offline escalation |
| Local privacy/secrets/SAST/no-deploy scans | Not a baseline obligation | PASS, including after browser execution |
| git diff --check for owned source paths | Not a baseline obligation | PASS |
| Registry dependency audit | Not run | OUTSTANDING under the approved local-only boundary |

Exact focused command:

```bash
npm run test:delivery -- tests/integration/runtime-config-cli.test.ts tests/unit/toolchain-validation.test.ts tests/unit/runtime-boundaries.test.ts
```

Configured domain coverage: 93.51% lines, 85.16% branches, 90.67% functions. Configured delivery runtime coverage: 94.59% lines, 95.34% branches, 91.30% functions. Both retained their 80% thresholds and match baseline measurements. These figures describe the configured scopes, not all production source.

Final formatting/lint/typecheck and the 49 focused tests were repeated after the last source/test corrections. Full tests and coverage passed with the same runtime behavior; the later child-environment correction was a TypeScript-only assertion documenting Next's required NODE_ENV type while intentionally testing absent NODE_ENV.

## Isolated Startup Acceptance

A disposable application copy contained the changed source, cloned installed dependencies and only synthetic `.env.example`-derived configuration. Contributor `.env.local` was neither read nor copied. There was no inherited `APP_RUNTIME_MODE` or `NODE_ENV`; Next telemetry was disabled for acceptance.

Both dev and production start returned HTTP 200 with:

```json
{"status":"ready","mode":"synthetic","marker":"waldorf-local-ready"}
```

The root returned HTTP 200 and the Hungarian entry marker. The actual predev, prebuild and prestart processes loaded configuration before framework work. Missing/invalid configuration rejection and inherited invalid-value precedence were separately established by the real npm prehook regressions.

The first default dev attempt passed its prehook but failed readiness amid host `EMFILE` watcher warnings and repeated Next restarts. The successful retry used `WATCHPACK_POLLING=true` only in the current process, documented in README. No machine file limit or shell profile was changed. The first build compiled, then rejected a stale copied version of a new test's NODE_ENV type; refreshing the disposable copy with the already-corrected test produced a passing build.

Browser and accessibility attempts initially failed before executing tests because the existing Firefox launch helper needed to write its automation metadata in the installed browser cache. The approved escalated retries used installed browser assets, performed no downloads, and passed Chromium, Firefox and mobile-Chrome checks. The helper's cache metadata write is existing verification behavior; no global shell/toolchain settings were changed.

## Traceability, Cleanup and Limits

FR1 is covered by README/toolchain checks; FR2 by the validator and CLI regressions; FR3 by the documented recipe and isolated startup acceptance; FR4 by regressions and current evidence. NFR1 is covered by dummy-secret output assertions and redacted diagnostics; NFR2 by synthetic temporary fixtures, loopback listeners and cleanup; NFR3 by unchanged compatibility/quality contracts and recorded checks.

All owned dev/start/smoke/browser server processes were stopped. Fixture tests remove their owned directories after each case. The disposable application copy and its generated build/agent files were removed. Loopback ports 3000, 3100–3102 and 3210 were confirmed free after execution. Raw synthetic command logs and pre-edit backups remain in `/private/tmp/waldorf-startup-fix-evidence/`; this summary retains the durable results.

Remaining verification limits:

- Dependency scanning that blocks high/critical vulnerabilities is still outstanding; no registry request was made. Merge readiness is not claimed.
- Existing coverage globs do not demonstrate the affirmed floor across every production source file; scripts/App Router remain a measurement gap. CLI child processes do not contribute to parent Vitest coverage counters.
- Default native watcher readiness on this host failed; the documented process-local polling route passed.
- Safari and linked production integrations were not exercised by this local task.

The two added regression files are the narrowest process-level reproduction plus toolchain unit tests. No thresholds were relaxed and no unrelated refactor was performed.


## Historical V8 Coverage Retry — Superseded by Authorized Istanbul Amendment

**Status: BLOCKED at Step 8; Code Generation is not complete.** Steps 1–7 and independent Step 9 acceptance are executed; Step 10 records this honest handoff. T07 remains Unverified because the installed V8 report fails integrity; T14 remains Unverified because registry access is unauthorized. Historical startup evidence above retains its original provenance and limited denominator.

### Changes and Scope

This retry changes exactly `vitest.config.ts` and the 16 explicitly named files beneath `tests/coverage/` in the approved plan. The cumulative [source-manifest.json](source-manifest.json) lists all 23 application/test/config paths with their current SHA-256 values. The six original startup files are byte-identical to retry baseline; all work remains on `bugfix/local-startup-fix`. No production/domain/App Router refactor, package mutation, registry request, installation or counter/threshold adjustment occurred. Concurrent framework/other-intent changes are outside this manifest.

The complete live inventory is 141 candidates: 124 runtime-bearing, 13 linkage-only and four type-only. Linkage dependencies are independently accounted for; import initialization and dynamic loading are not excused. Default imports plus named type imports, empty imports and malformed/null/array/negative counters have explicit support assertions. Linkage resolution handles TSX/JS/MJS and index module paths. CSS is inventoried separately because V8 supplies no CSS counters; browser rendering remains behavioral evidence. Verification scripts remain in the executable denominator.

### Actual Verification

| Check | Result |
|---|---|
| Node/npm | Node 24.21.0; npm 11.19.0; current-process Homebrew PATH |
| Baseline toolchain/format/lint/typecheck/tests/old coverage | Passed; native 128 + delivery 98. Old coverage remains limited scope |
| Existing startup regression subset | 49 passed |
| Adapter/inventory support | 9 passed |
| Native/adapted domain correspondence | 128 passed each; exact executed case-name multisets match, no missing/extra cases |
| New application page/action/session subset | 116 passed |
| New framework/CLI/smoke/verification subset | 24 passed |
| Full final native + delivery suite | 128 + 247 = 375 passed |
| Formatting/lint/strict types | Passed; explicit owned-file formatting check also passed |
| Privacy/secrets/SAST/no-deploy | Passed, without registry audit |
| Initial complete coverage measurement | Exit 1: lines 927/1915 = 48.40%; branches 822/1828 = 44.96%; functions 435/674 = 64.54%; floors unchanged |
| Subsequent full coverage gate | Exit 1: invalid V8 map; no trusted final percentages claimed |
| Isolated real production build/start/smoke | Passed with synthetic `.env.local`, no APP_RUNTIME_MODE/NODE_ENV exports |
| Documented dev procedure | Passed readiness/root selection using process-local WATCHPACK_POLLING=true |
| Installed loopback browser / accessibility | 96 / 15 passed after approved sandbox EPERM retries |
| Cleanup | Owned temporary acceptance copy removed; owned ports free |

The build initially rejected an out-of-root dependency symlink. Rerunning with actual APFS-cloned installed dependencies passed. Browser/a11y first attempts hit the known sandbox restriction writing Firefox automation metadata; explicitly approved escalation retries passed without downloads. These are setup/platform failures, distinguished from production assertion failures. Early fixture/cache/type-check issues in new tests were corrected without changing production code. Real assertions remain intact; subprocess/browser execution is not credited to parent coverage.

### Coverage Integrity Blocker

The final raw full map reports `app/admin/actions.ts`, branch `31`, source line 183–186, counters **[2, -1]**. The integrity reporter rejects this instead of clamping, dropping, taking absolute values or fabricating coverage. A single statically imported action test file reproduces it with all 28 assertions passing; a single notes-success case has a valid map and only an expected low-floor failure. The action file already imports production modules once and resets real synthetic fixtures/mocks/session state between cases, without `vi.resetModules`.

Bounded OXC ESNext/ES2016 and installed TypeScript source-map transform experiments still reproduced the invalid counter. Ineffective variants were removed; provider remains V8 4.1.11. This supports a remapping/tooling diagnosis, not proof of a particular upstream defect. Required gap closure cannot be certified while the report is malformed. [tooling-amendment.md](tooling-amendment.md) specifies the preferred aligned Istanbul 4.1.11 package/config amendment, exact authorization-dependent install/audit commands, offline alternative, effort/cost/risk and retained approval receipt. No amendment is executed.

### Durable Evidence and Tracking

All selected evidence is under `evidence/coverage-retry/`; [index.json](evidence/coverage-retry/index.json) lists every exact evidence filename, byte size and SHA-256 (49 files). Relevant durable files include:

- Baseline: `baseline-check-toolchain.log`, `baseline-format-check.log`, `baseline-lint.log`, `baseline-typecheck.log`, `baseline-test.log`, `baseline-test-coverage.log`, `startup-focused.log`.
- Assertion/adapter/inventory: `support-final.log`, `native-reference.log`, `adapter-scenarios-final.log`, `adapter-comparison.json`, `production-inventory.json`, `application-third.log`, `boundaries-final.log`, `retry-tests-final.log`.
- Measurements/failures: `adapter-coverage.log`, `adapter-coverage-fixed.log`, `expanded-initial-fixed.log`, `retry-coverage-final.log`, `admin-map-confirmation.log`, `admin-map-single-case.log`, `admin-minimal-interaction.log`, `admin-oxc-esnext.log`, `admin-project-es2016.log`, `admin-typescript-transform.log`.
- Raw maps: `full-negative-map.json`, `admin-negative-map.json`, `admin-negative-oxc-map.json`, `admin-negative-typescript-map.json`, `single-case-map.json`.
- Quality: `retry-format-final.log`, `owned-format-check-final.log`, `retry-lint-final.log`, `retry-typecheck-final.log`, `final-privacy.log`, `final-secrets.log`, `final-sast.log`, `final-no-deploy.log`.
- Acceptance/cleanup: `acceptance-build.log`, `acceptance-build-cloned.log`, `acceptance-start.log`, `acceptance-dev.log`, `acceptance-start-dev.json`, `acceptance-smoke.log`, `acceptance-browser.log`, `acceptance-browser-escalated.log`, `acceptance-a11y.log`, `acceptance-a11y-escalated.log`, `cleanup.txt`.

Existing unanchored `coverage/` Git/Prettier ignores also match approved `tests/coverage/`; no ignore files were changed. Explicit formatting was verified with `--ignore-path /dev/null`. The conductor must explicitly track these 16 test/support paths and desired `.log` evidence before a Git-based fingerprint/commit; all are listed by exact path/hash in the manifests. No real environment contents or secrets are recorded. Registry audit, linked integrations and deployment remain outside verified evidence.
