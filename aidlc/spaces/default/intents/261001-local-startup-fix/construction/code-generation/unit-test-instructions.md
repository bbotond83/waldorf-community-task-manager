# Coverage Retry — Test Instructions

## Prerequisites and Ordering

Use installed Node24/npm11 and Vitest4.1.11 with the authorized @vitest/coverage-istanbul4.1.11 amendment; retain installed V8. Read the complete unchanged Testing Contract and consume the conductor's fresh tool-produced brief before application actions. The user's Package + audit decision authorizes this exact amendment under the current relaxed fence, preserving the existing Approve Plan receipt without an automatic reset. Test-after applies: implement the measurement config/support, then test it; application/script implementations already exist, so new behavior tests are written after that implementation and after runner readiness.

Retain README.md, scripts/validate-runtime-config.ts, tests/integration/runtime-config-cli.test.ts and tests/unit/toolchain-validation.test.ts byte-identically. Package/lock changes are restricted to adding exact devDependency @vitest/coverage-istanbul4.1.11 and its necessary graph; retain V8 and existing startup metadata/scripts. Historical V8 metrics/failures remain separate evidence. Network scope permits only this npm-registry install and the conductor's read-only final-lock audit; no browser download, integration, deployment, global change or automatic fixes.


## Authorized Provider Setup and Focused Validation

After the fresh brief, install only the authorized provider:

```bash
npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11 --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
```

Confirm actual installed provider/runner versions4.1.11 and inspect package/lock drift before switching vitest.config.ts to provider istanbul. Package availability has not been queried in planning. Preserve80/80/80, full denominator/map integrity and both projects. Then run the support command below before trusting coverage. Reproduce the former invalid action map with real assertions:

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --coverage --project delivery tests/coverage/admin-actions.test.ts
```

A scoped run may fail global floors; malformed/negative/missing-runtime counters remain fatal. Compare actual128 native/adapted case names with a verbose run that retains the integrity reporter:

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --coverage --project domain-coverage --reporter verbose --reporter ./tests/coverage/support/production-coverage-reporter.ts
```

Validate the real installed map API/callback/source mapping; fix only approved support/config dimensions. Capture a distinct complete Istanbul baseline before meaningful gaps are added inside existing named test files. Use the exact application/boundary/full commands below after additions; do not replace measured production functions.

Explicit owned-file formatting remains required because existing ignore patterns match tests/coverage:

```bash
node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null 'tests/coverage/**/*.ts' 'tests/coverage/**/*.tsx' vitest.config.ts
```

The conductor owns the separate read-only final-lock command `npm audit --audit-level=high --registry=https://registry.npmjs.org`. Do not invoke the registry-bearing verification pipeline or automatic fixes as part of tests.

## Exact Scoped Commands

Run from the application root under current-process Homebrew PATH. Direct node/Vitest commands additionally require the installed npm CLI path for the retained startup prehook tests; set only in this terminal:

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
export npm_execpath=/opt/homebrew/opt/node@24/lib/node_modules/npm/bin/npm-cli.js
```

Npm-script invocations supply npm_execpath automatically. Serialize coverage runs because their provider temporary output directory is shared. Each test command has exact paths or an exact coverage/domain project filter; no bare `npm test` belongs in this stage's scoped instructions. Full existing quality commands are recorded in plan baseline/final steps.

Existing runner/startup readiness before new measurement support:

```bash
npm run test:delivery -- tests/integration/runtime-config-cli.test.ts tests/unit/toolchain-validation.test.ts tests/unit/runtime-boundaries.test.ts
```

After measurement-support implementation, its focused tests:

```bash
npm run test:delivery -- tests/coverage/domain-adapter.test.ts tests/coverage/production-inventory.test.ts
```

Unchanged native-domain reference:

```bash
node --experimental-strip-types --test "src/**/*.test.ts"
```

Coverage-only adapted domain compatibility (repeat after provider change):

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --coverage --project domain-coverage
```

That last subset may fail the global expanded threshold because application sources remain uncovered. Record the failure honestly while comparing domain assertions/case counts; it does not waive the complete-report gate. Configuration must retain reports on failure.

Application subset after support readiness:

```bash
npm run test:delivery -- tests/coverage/app-entrypoints.test.tsx tests/coverage/admin-pages.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/staff-pages.test.tsx tests/coverage/admin-actions.test.ts tests/coverage/parent-actions.test.ts tests/coverage/app-session-boundaries.test.ts
```

Executable-boundary subset:

```bash
npm run test:delivery -- tests/coverage/framework-entrypoints.test.ts tests/coverage/runtime-cli-instrumentation.test.ts tests/coverage/smoke-entrypoint.test.ts tests/coverage/verification-entrypoints.test.ts
```

Whole-retry final coverage, with exact project selectors:

```bash
node node_modules/vitest/vitest.mjs run --config vitest.config.ts --coverage --project delivery --project domain-coverage
```

The delivery project discovers the retained delivery tests and named tests/coverage files; domain-coverage discovers the existing source test files. This is intentionally the complete denominator required by this zero-Unit retry. `npm run test:coverage` remains the canonical complete project gate in the plan and must exercise the same map/integrity checks.

## Assertion and Instrumentation Contract

| Group | Meaningful asserted outcomes |
|---|---|
| Adapter/inventory | Real assertions/callbacks execute; native and adapted domain scenarios correspond; runtime-file omission and malformed counters fail; only justified zero-runtime files lack counters |
| Entry/admin/parent/staff pages | Real page/layout/loading/error output, signed-out/role/scoped states, redacted denied/config errors, permitted data/controls and navigation |
| Actions/session/facades | Actual validation/result codes, authorized mutation/version/idempotency behavior, denied/revoked sessions, safe destinations/cookies and successful revalidation |
| Framework entrypoints | Nonce-bearing CSP propagation and security header values |
| CLI instrumentation | Actual entrypoint defaults/explicit modes, valid/invalid effective config, safe loader/schema/toolchain failures and exit behavior |
| Smoke | Readiness/root assertions, failed/timeout cases and guaranteed owned-child cleanup |
| Verification entrypoints | Manifest/evidence acceptance and rejection, scan findings/redaction, command ordering/failed-step halt, safe report provenance and temporary Firefox metadata |

Tests must invoke the production functions/modules being measured. Framework/process/I/O seams may be mocked; replacing the measured function with a mock earns no implementation coverage. Success, representative failure and edge outcomes are required for each tested behavior. Assertions must fail when the behavior is wrong; import-only tests, forced counter values and always-successful mock pipelines do not establish correctness.

Start with expanded measurement and add cases for actual gaps. Minimal strategy remains requirement-driven; the affirmed whole-source floor can require more tests than the usual 5–15 guideline. Do not introduce unrelated source refactors or lower targets to stay within that guideline.

## Configuration, Inventory and Reports

Configure named projects `delivery` and coverage-only `domain-coverage`; keep the existing jsdom/setup behavior in delivery. Domain-coverage runs in Node and alone aliases node:test to `tests/coverage/support/node-test-adapter.ts`. Ordinary native tests remain runnable unchanged. Inspect all used APIs and compare executed scenario names/counts, not just import success.

The complete candidate scope is app TS/TSX, non-test src TS/TSX, scripts TS/MJS/JS, proxy.ts and next.config.ts. The static count was 141; live discovery is authoritative. Inventory test/config/support tooling and CSS separately by purpose. Declaration-only, type-only and linkage-only files can have zero JavaScript runtime counters; classification must be derived from syntax rather than lack of coverage. Missing runtime-bearing files are fatal. Generated/dependency/test artifacts must not enter the production denominator.

Use Istanbul text, JSON summary and JSON detail reports under the ignored coverage directory, plus a machine-readable source-relative inventory. The onCoverage reporter validates the actual map shape, candidate completeness and classifications during every full coverage gate. Unknown reporter shape, missing callback invocation, absent executable paths or stale reports are failures to investigate. Support tests intentionally submit an incomplete map and must see rejection; never omit a source to make this test pass.

Global minimums remain **80% lines, 80% branches, 80% functions**. Keep the native-domain gate as an additional obligation. Report full-map raw covered/total counters and per-file gaps; do not average percentages across maps or claim child/browser execution populated this report. Do not add ignores, alter blank lines, suppress branches or raise mock coverage instead of testing real behavior.

## Isolation and Error Evidence

Use invented synthetic fixtures, real local synthetic facades/tokens and safe bounded inputs. Mock async Next platform hooks (cookies/navigation/cache/server-only) and external/process boundaries within isolated workers, resetting mocks/modules/env/fixture state after cases. CLI in-process tests must restore process mocks even on simulated exit; real subprocess tests retain sanitized inherited env and temporary file isolation.

No direct test may invoke the registry-bearing verification runner pipeline, deploy command, production integration or real private configuration. Its subprocess seam is mocked and expected audit arguments are assertions only. Firefox-helper tests use temporary invented metadata and a mocked executable path; they do not write the user's browser cache. Smoke tests own any fake/temporary child resources and validate cleanup. Existing browser acceptance uses installed browsers and synthetic loopback only after approval.

Capture actual failures and uncovered ranges. A threshold-failing initial measurement is evidence of remaining work, not a passing gate. Stop claims of T07 Met until floors and denominator integrity both pass. The conductor already captured pre-install audit exit0/zero vulnerabilities for539 dependencies; preserve that provenance separately. T14 requires the conductor's actual authorized final-lock registry-only audit evidence, with no automatic fixes. Preserve all prior evidence/Loop-Back Log; record this attempt's results separately before updating the summary at implementation completion.
