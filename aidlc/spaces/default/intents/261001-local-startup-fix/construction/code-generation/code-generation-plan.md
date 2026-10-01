# Local Startup Fix — Whole-Source Coverage Retry Plan

## Scope, Authority and Retained Work

This is the new zero-Unit Code Generation attempt following the owner's `-Retry with fix` decision. Read the unchanged append-only `../build-and-test/test-results.md` Loop-Back Log (one retry used), approved requirements FR1–FR4/NFR1–NFR3, and the current `code-generation-questions.md` consolidated summary. This plan addresses T07's whole-production-source measurement gap. The user subsequently selected **Package + audit**, authorizing the concrete Istanbul amendment below and a separate read-only npm-registry audit owned by the conductor.

Preserve the existing startup implementation and previous `code-summary.md` evidence until recording this attempt's actual results after generation. Keep `README.md`, `scripts/validate-runtime-config.ts`, `tests/integration/runtime-config-cli.test.ts` and `tests/unit/toolchain-validation.test.ts` byte-identical. The only newly authorized package/lock change is adding exact devDependency `@vitest/coverage-istanbul@4.1.11` and its necessary locked dependency graph; preserve the existing V8 package and all startup scripts/dependency declarations. No domain/App Router production refactor is planned. All changes remain on `bugfix/local-startup-fix`; preserve concurrent edits, prior Build and Test records and the existing hook repair.

The Testing Contract below retains test-after ordering unchanged. The existing Approve Plan receipt remains valid under the current relaxed fence; the user's concrete Package + audit choice authorizes this amendment without an automatic receipt reset or redundant Plan Approval. Before implementation, consume the conductor's fresh complete `aidlc engine testing-posture brief --stage-level` binding this updated plan/instructions. This planning handoff performs no executable checks, installation or application edits.

## Denominator and Instrumentation Design

Static inventory currently finds 70 App Router TS/TSX files, 60 non-test src TS/TSX files, nine executable scripts, `proxy.ts` and `next.config.ts`: **141 candidates**, not 141 measured runtime files. Discover the live inventory after approval rather than freezing that count as a metric.

The expanded coverage globs include `app/**/*.{ts,tsx}`, `src/**/*.{ts,tsx}`, `scripts/**/*.{ts,mjs,js}`, `proxy.ts` and `next.config.ts`. Keep all application/runtime code, startup validators, smoke and verification scripts in the executable candidate set. Only source test files, declaration-only files, generated artifacts and dependencies are outside runtime measurement by purpose. Test/lint/browser configuration and the tests/coverage support machinery are verification tooling, listed separately. Inventory `app/globals.css` separately because JavaScript coverage providers have no CSS counters; CSS behavior remains exercised through existing rendering/browser checks.

Retain type-only and module-linkage-only candidates in the inventory. A missing or empty counter entry is acceptable only when TypeScript/JavaScript syntax analysis establishes zero executable runtime statements; record the file and classification. Never assign artificial covered counters, credit blank/type-only lines, suppress a production function or exclude a poorly covered path. Runtime-bearing missing files are a report-integrity failure.

Use installed Vitest 4.1.11 with newly authorized `@vitest/coverage-istanbul@4.1.11` for **one Istanbul coverage map**; preserve installed `@vitest/coverage-v8@4.1.11` as historical tooling with global 80% lines/branches/functions. Preserve the existing native domain gate and ordinary delivery project. During a coverage run, add a separate Node project for existing `src/**/*.test.ts`, aliased only in that project to a small node:test compatibility adapter. Its currently observed APIs are default test, describe, it and beforeEach; validate real compatibility before trusting those tests' counters. Browser/process children are not automatically measured by parent instrumentation. New direct entrypoint tests supply parent instrumentation while the real subprocess/browser regressions retain behavioral evidence.

The final report uses text, json-summary and JSON maps. Installed Vitest reporter types expose `onCoverage(coverage: unknown)`; the planned integrity reporter validates its runtime shape, normalizes paths and checks the map against the inventory. The ordinary `npm run test:coverage` command must fail both on an unmet floor and on an omitted executable candidate. Report on failure so uncovered paths can be diagnosed; failure is not a passing result. Do not sum separate percentages or silently merge incompatible/native/browser maps.

## Exact Change Paths and Impact

| Path | Responsibility |
|---|---|
| package.json | Add exact devDependency @vitest/coverage-istanbul4.1.11 only; retain V8 and existing startup metadata/scripts |
| package-lock.json | Lock the authorized provider and necessary transitive graph; inspect and reject unrelated package/version drift |
| vitest.config.ts | Switch provider to Istanbul; retain named projects, complete scope, unchanged floors and report-integrity reporter |
| tests/coverage/support/node-test-adapter.ts | Map the currently used node:test default/named APIs to Vitest; coverage-project alias only |
| tests/coverage/support/production-inventory.ts | Discover executable candidates, classify zero-runtime modules/CSS/tooling, validate coverage-map completeness |
| tests/coverage/support/production-coverage-reporter.ts | Validate final coverage map during onCoverage; emit denominator/provenance inventory and fail on omissions |
| tests/coverage/domain-adapter.test.ts | Assert adapter API/callback behavior and unchanged native-domain case execution |
| tests/coverage/production-inventory.test.ts | Executable omission rejection, honest zero-runtime handling, stable paths and purpose-based scope |
| tests/coverage/app-entrypoints.test.tsx | Home/root/authentication/invitation/access-denied entry and readiness/reset/session routes |
| tests/coverage/admin-pages.test.tsx | Admin pages/layout/loading/error rendering and permitted/denied/validation states |
| tests/coverage/parent-pages.test.tsx | Parent pages/layout, list/detail/notification and operation-state projections |
| tests/coverage/staff-pages.test.tsx | Staff pages/layout/loading/error, scoped filters/detail and read-only/denial behavior |
| tests/coverage/admin-actions.test.ts | Core/advanced actions: validation, authorization, mutation results, idempotency and revalidation |
| tests/coverage/parent-actions.test.ts | Parent/authentication/invitation actions: validation, session/cookie outcomes, safe destinations and error states |
| tests/coverage/app-session-boundaries.test.ts | Real role sessions/facades/action-state helpers with framework seam mocks |
| tests/coverage/framework-entrypoints.test.ts | Proxy CSP/nonce and Next config security headers |
| tests/coverage/runtime-cli-instrumentation.test.ts | In-process measured validator/toolchain execution with safe process/environment mocks |
| tests/coverage/smoke-entrypoint.test.ts | Measured smoke entrypoint readiness, failure/timeout and owned-child cleanup |
| tests/coverage/verification-entrypoints.test.ts | Measured local verification scripts: evidence/manifests/scans/Firefox helper and orchestration success/failure |

Impact: medium. `vitest.config.ts` changes the coverage command's denominator and adds new test discovery; ordinary delivery behavior and its existing setup remain intact. The coverage-only adapter changes how existing domain assertions are scheduled for that report, so native and adapted suites must be compared. New tests import App Router/scripts through narrowly mocked platform seams; production functions remain real. The integrity reporter makes missing-file evidence a blocking error.

All named test files are fixed approved destinations for measured gaps. Add cases inside these files as needed; do not create unplanned production source changes merely to improve a percentage. Existing test files remain consumers. Only the explicitly authorized Istanbul package/necessary dependency download from the npm registry is added. No package script, browser download or global configuration change is authorized.

## Ordered Retry Steps

- [x] **Step 1 — Reestablish the source baseline after fresh Plan Approval.** Verify branch/working-tree ownership, snapshot the six retained startup files and planned pre-existing config, and compare retained paths with prior fingerprints. Select the existing Homebrew Node24/npm11 only in current-process PATH. Record actual `node --version`, `npm --version`, `npm run check:toolchain`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:coverage` against current source before config edits. These baseline percentages remain the old limited scope. Record failures without changing targets. (FR1–FR4, NFR1–NFR3)
- [x] **Step 2 — Verify installed runner/API readiness.** Run the exact existing scoped startup regression command in `unit-test-instructions.md`; inspect installed Vitest project/coverage/reporter types and installed Next testing/environment guides. Confirm only existing installed tools will be used. Identify the node:test APIs actually exercised by source tests and retain their native invocation as the reference. Do not assume an alias is compatible merely because imports resolve. (FR4, NFR3)
- [x] **Step 3 — Implement measurement configuration and support.** Modify `vitest.config.ts` to preserve the ordinary delivery setup, discover named coverage tests, add the coverage-only Node domain project with its private alias, and extend coverage to the complete candidate globs. Keep 80/80/80 floors, failed-run reports and existing native gate. Implement the three named support files: adapter, source inventory/map validator, and onCoverage reporter. Emit source-relative inventory/classifications and measurable missing paths; reject malformed/empty/stale/incomplete maps. Install no package. (FR4, NFR3)
- [x] **Step 4 — Write/run measurement-support tests after implementation.** Add the named adapter and inventory tests. Assert exported adapter functions match intended Vitest scheduling APIs and callbacks/assertions execute; compare the actual adapted domain scenario list/count against the unchanged native suite. Inventory tests must reject a missing executable file and malformed counters, tolerate only genuinely zero-runtime declarations/linkage, normalize equivalent paths, and demonstrate that uncovered executable branches remain in the denominator. Run the exact support command and native domain reference. Any incompatible adapter or nonfiring onCoverage callback is a tooling failure to resolve before claiming coverage. (FR4, NFR3)
- [x] **Step 5 — Measure the expanded initial denominator.** Run `npm run test:coverage` with the implemented measurement support and existing tests. Record its actual exit, raw counts, classifications and uncovered line/branch/function ranges. Expect uncovered application/script areas may cause a threshold failure; preserve that failure as measurement, not a waived gate. Confirm zero-hit runtime files appear and intentional omission is detected by support tests. Prioritize real executable gaps, weighted by uncovered counters and behavioral risk. No application percentage is asserted in advance. (FR4, NFR3)
- [x] **Step 6 — Add direct application behavior coverage.** The production layers already exist, so follow test-after by writing/running the seven named application test files after runner readiness. Use real synthetic runtime/domain facades, session tokens and actual page/action modules; mock next/headers, next/navigation, next/cache and server-only boundaries as required. Assert rendered headings/controls/data/privacy/role projections, safe navigation, returned result states/codes, cookie attributes, mutation/version/idempotency outcomes and revalidation. Include signed-out/invalid/production-unlinked cases, forbidden roles/scopes, validation/conflict/retry/terminal paths and loading/error components. Mock a dependency result only to induce its documented boundary error; do not mock the production function whose counters are being claimed. Run the exact application subset, then inspect changed uncovered ranges. (FR4, NFR1–NFR3)
- [x] **Step 7 — Add measured executable-boundary coverage.** Write/run the four named framework/CLI/smoke/verification entrypoint tests against real module entrypoints with child-only or worker-isolated mocked process, clock, filesystem, child_process, fetch and browser-cache seams. Validate CSP/header propagation; CLI default/explicit mode selection and safe failures; smoke readiness/failure/timeout/cleanup; manifests/evidence/scanning redaction and omission rejection; verification orchestration's command ordering, failed-step halt and safe evidence; Firefox metadata handling using only invented temporary files. The local verification runner's registry subprocess is mocked and never executed. Keep existing real subprocess startup regressions. Assert outputs and side effects, not merely import success or mock call existence. No real external/production call or private env/cache read occurs. (FR2, FR4, NFR1–NFR3)
- [x] **Step 8 — Install the authorized Istanbul provider, validate measurement, then close actual gaps.** Consume the conductor's fresh complete testing-posture brief before implementation; retain the existing Approve Plan receipt. Verify Node24/npm11, branch/ownership and four retained startup hashes. Run `npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11 --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org`. Confirm installed provider/runner versions4.1.11 and inspect package/lock diff for unrelated drift; preserve V8. Change only the configured provider to Istanbul, retaining named projects/alias/setup, all candidate globs,80/80/80 floors and report-integrity rejection. After implementation run the exact support/action/native/verbose-domain commands in instructions; confirm128 actual domain case names/counts, callback/map shape and genuine source-map counters. Then run npm run test:coverage, preserve distinct raw Istanbul baseline/failures/inventory and prioritize actual uncovered counters. Add meaningful cases within the existing seven application/four executable files, using real production functions and narrow framework/process seams; run their exact subsets after additions, then explicit full delivery+domain coverage and canonical coverage. Require complete valid map and all floors; never normalize negative counters, average reports, count children as parent coverage or exclude difficult runtime code. Stop with exact evidence if tooling/mapping/gaps require another user decision. Availability has not been queried during planning. (FR1–FR4,NFR1–NFR3)
- [x] **Step 9 — Refresh final delivery/acceptance and audit provenance.** After provider/gap changes, rerun npm run check:toolchain, npm run format:check, the explicit owned-file Prettier check in instructions, npm run lint, npm run typecheck, npm test and exact startup regressions. In a disposable current-source copy with actual cloned installed dependencies and synthetic env, rerun production build/start/smoke/dev readiness without APP_RUNTIME_MODE/NODE_ENV exports, installed browser/a11y and privacy/secrets/SAST/no-deploy checks; clean owned resources. Use documented process-local polling and approved escalation for sandbox browser restrictions. The conductor owns authorized read-only `npm audit --audit-level=high --registry=https://registry.npmjs.org` on the final lock; preserve the pre-install exit0/zero-vulnerability539-dependency audit as separate historical provenance, and do not claim final audit results before actual evidence. No automatic fixes. (FR1–FR4,NFR1–NFR3)
- [x] **Step 10 — Record amendment evidence and handoff.** Update cumulative code-summary/source-manifest/traceability and progress after actual execution. Ownership comprises the prior17 paths plus package.json/package-lock.json:19 amendment-capable paths; record all actual cumulative application paths/current hashes and preserve four unchanged startup hashes/original package startup metadata. Keep historical V8 [2,-1] failures and pre-install audit evidence immutable; publish distinct durable Istanbul raw counters/inventory/gaps/failures/domain comparison/acceptance and conductor-provided final-lock audit evidence. T07 is Met only with complete meaningful valid coverage and all three floors; T14 depends on actual final-lock audit/no high-critical findings. The conductor handles ignored-file tracking, review/lifecycle and current relaxed fence; do not reset receipts or claim completion with a remaining required blocker. (FR1–FR4,NFR1–NFR3)


## Requirement and Failure Traceability

FR1–FR3 and NFR1–NFR2 retain their existing implementation and startup regressions, with new application/CLI tests strengthening evidence. FR4 maps to the new support/application/entrypoint tests and current coverage evidence. NFR3/T07 maps to `vitest.config.ts`, inventory/report validation and actual full-source line/branch/function counts. T14 maps to a separately authorized audit result only; no coverage result supplies vulnerability evidence.

A test assertion failure, incompatible adapter, missing executable report path, stale/malformed map or sub-80 metric is a failure, not an exclusion opportunity. Existing quality failures block readiness claims. Targeted failures must be fixed with meaningful cases within these named paths or surfaced with an explicit blocker. Browser/platform limits and forbidden registry checks stay separately recorded.

## Effort, Rollback and Limits

Authorized provider amendment estimate:0.5–1 engineering day for provider/adapter validation plus1–3days for measured gaps, $0 new tool fees, medium risk; source-map/branch semantics differ and attainment is not guaranteed. Historical V8 evidence stays preserved. Biggest uncertainties are source-map counter completeness, native-test adaptation, asynchronous App Router hooks and the number of uncovered branches. The plan does not guarantee attainment before measurement.

Rollback selectively restores this attempt's Vitest config hunks and removes only newly authored coverage files with no concurrent edits. Retain the four unchanged startup files, original package/lock startup metadata, prior records and all append-only Build and Test evidence. Do not reset the branch, overwrite unrelated changes or weaken a threshold. Keep testing local/synthetic. Network scope is limited to the npm registry for the exact provider installation and conductor-owned read-only audit. No browser download, global setting, deployment, production integration, automatic audit fix or linked target is authorized.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "bugfix",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "We write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Include a targeted regression for the bug or vulnerability.",
      "Keep the existing test suite green."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:7c518eeb0563e4243e4415138b3a1314576f035caa0f437fd2593a8496b8de11",
  "contract_sha256": "sha256:5952450cbff1eecbe74dd032446a49ff2392f2f7fbd0f96e7cfdc5a3adeef5c2"
}
```
