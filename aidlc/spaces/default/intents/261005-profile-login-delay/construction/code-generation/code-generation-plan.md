# Profile Login Delay Code Generation Plan

## Scope and Current Evidence

One stage-level brownfield implementation iteration; no Unit DAG. Approved requirements are the source of scope; User Stories and design stages are absent by scope. Initial plan preparation ran no tests, browser measurements, server restarts or application edits. Subsequent original Chrome retry reproduced a 131508 ms session POST/303: first-byte wait 10.954 ms, zero-body response completion 131496 ms, with `Clear-Site-Data: "cache"`. The controlled same-server 30-flow baseline passed and therefore did not reproduce the affected browser state. See `native-chrome-retry.md`, `native-chrome-network-timings.json` and `baseline-summary.md`. Chrome at `http://127.0.0.1:3000` and the usable business-page endpoint are confirmed.

Implement only a demonstrated shared cause after actual-environment attribution. The response interval and Chromium's redirect-deferred cache-clearing implementation now identify `Clear-Site-Data` as the causal intervention candidate. After the preserved baseline and quality baseline, preview and apply a reversible one-line removal, then immediately write/run endpoint tests and retry the original Chrome context without cache reset or server restart. Retain the correction only if the paired evidence supports it; otherwise restore only the owned intervention and investigate. Preserve force-dynamic authorized pages, signed cookie rotation, full-document form/303 navigation and profile boundaries; verify real production cache headers, sign-out and history/switch isolation. The full server launch is outside the timer; selection-triggered compilation and navigation are inside it.

## Profile Completion Contract

Derived from `src/runtime/synthetic/profiles.ts`, existing pages and their stable selectors. Timer starts in the profile form's actual submit event, follows the 303/session/root chain, then immediately clicks the profile's home navigation link without human delay. Timer ends only when the correct profile summary, exact destination, successful content and enabled primary control below are simultaneously observable. A greeting, error/loading panel or old-profile state cannot pass. Preserve the first relevant route use before diagnostics.

| Profile ID | Main URL | Visible successful content | Enabled primary control |
|---|---|---|---|
| `parent-local` | `/szulo/feladatok` | `parent-duties-page`, heading `Családi feladatok`, successful `duties` panel and `duty-list` with a visible fixture duty | `duty-filter-submit-button` (`Szűrés`) and enabled `duty-filter-select` |
| `staff-local` | `/munkatars/beosztas` | `staff-schedule-page`, heading `Beosztás`, successful `staff-schedule` panel, `staff-schedule-table` with a visible authorized row | `staff-schedule-filter-submit-button` (`Szűrés`) and enabled `staff-schedule-group-select` |
| `group-admin-local` | `/admin` | `admin-dashboard-page`, heading `Áttekintés`, all four successful numeric summary panels: `admin-dashboard-summary`, `admin-dashboard-records-state`, `admin-dashboard-tasks-state`, `admin-dashboard-queue-state` | `app-shell-navigation-admin-tasks` (`Feladatok`) with href `/admin/feladatok` |
| `kindergarten-admin-local` | `/admin` | Same successful dashboard checks; `app-shell-profile-summary` identifies this exact administrator | Same enabled tasks link |
| `super-admin-local` | `/admin` | Same successful dashboard checks; `app-shell-profile-summary` identifies this exact administrator | Same enabled tasks link |

Baseline records fixture state without mutation. If fixtures cannot provide the listed successful content, record that blocker and request recovery under FR1.3; do not substitute an error/empty panel as success. After the stop timestamp, perform a functional primary-control interaction/check separately to confirm usability without adding arbitrary human time to the timer. Check unauthorized navigation and previous-profile content absence separately.

## Measurement Protocol

Use the same automation and table for before/after. Record every attempt, failures included, with profile, source profile, destination, kind, duration, result, browser/version, origin, server PID/mode/toolchain when discoverable, git revision and working-tree delta, active output/cache state, observed browser cache/extension/service-worker state, and intentional changes. Redact cookies, tokens, secrets and private content. Capture POST, redirect/root, immediate destination, assets, errors and corresponding available server request/compilation durations to attribute the delayed interval; explain gaps and distinguish evidence from hypotheses.

After initial Plan Approval, prepare an owned temporary diagnostic harness under `/private/tmp` before Step 1, using installed Playwright and the exact submission timer, immediate navigation, readiness table and matrix below. This preparation writes diagnostic files outside the repository only; it makes no repository/application edits and has no server-start, server-stop, fixture-reset or cache-clearing operation. Its browser observations and explicit profile selection/sign-out operations are the measured login exercise; they do not reset fixture data, server output or existing browser cache. Record the temporary harness text/version with the baseline evidence. Use that same harness for before/after comparison, then port its completion and timing contract to the repository regression files at Step 5. The new Step 5 spec/config is therefore not a prerequisite for collecting the pre-change baseline. Existing-tab observation still precedes temporary browser-context measurements.

Minimum actual-environment matrix per side is 30 timed flows: for each profile, one first selection in a fresh temporary Chrome context, two repeated first selections in that context using explicit sign-out between attempts, one switch from the next profile in the existing definition order (wrapping around), and two repeated switches from that same source profile. Source setup is outside the target timer and its own outcomes are recorded. Workers 1, retries 0; no route warm-up, unrelated navigation or implicit retries. Also preserve one initial observation in the affected existing Chrome tab before creating temporary contexts. If the initial tab cannot be inspected or instrumented safely, report the limitation and request the missing reproduction step. Never represent another Chromium instance as the user's affected Chrome.

Temporary contexts begin with empty browser HTTP cache and no session; retain their natural caches for repeat/switch attempts. Do not disable browser caching or erase the user's Chrome profile. The actual server remains as found: no server/output/cache reset between baseline runs. Record the first use of each destination on that server; the three administrator profiles share `/admin`, so later selections are server-warmed and must be labelled accordingly. Unknown server cache state is unknown, not cold. Following correction, repeat the same matrix, documenting hot reload/restart and unavoidable compilation-state differences explicitly. A server restart or cache intervention needed to test the demonstrated cause requires preserved baseline and a concrete reviewed operation for that existing server; do not substitute an isolated server or quietly reset it.

Supporting controlled development/production regressions run separately: the existing five-profile × two-mode cases, each with a first flow and a switch flow (20 timed flows). Development uses the existing dedicated empty output per owned process; production uses a prebuilt bundle with fresh process. Browser context/cache starts fresh per case, retains natural cache for switching; no business-route warm-up. Server readiness and selector loading precede timing; destination first-use compilation stays inside timing. These are supplemental cold/repeated observations, not actual-server acceptance.

Every successful target flow must be finite, nonnegative and <=5000 ms inclusive. Any over-budget flow, wrong profile, error, unavailable content or disabled required control fails. Record timeouts as failures with elapsed/lower-bound evidence rather than discarding samples. Do not average away failures. If the affected server is missing or the delay remains unreproduced, document attempted conditions and missing evidence, leave FR1/FR2 unresolved, and obtain the user's next reproduction step before claiming a fix or implementing a speculative optimization.

## Blast Radius

| Surface | Consumers and risk | Planned action |
|---|---|---|
| `app/api/synthetic/session/route.ts`; `src/runtime/composition.ts`; `src/application/index.ts` | All five profiles, sign-out, root and protected role pages; high impact | Read and instrument the shared chain; change only the attributed bottleneck. Preserve mode/origin/schema/cookie protections and module ports. |
| `src/runtime/ProfileSelector.tsx`, `src/runtime/AppShell.tsx`, `app/page.tsx` | Selection, root greeting and authorized navigation; medium impact | Preserve existing forms/303 chain and Hungarian accessible behavior; modify only if evidence attributes delay here. |
| `next.config.ts`, `scripts/validate-toolchain.mjs`, `scripts/validate-runtime-config.ts`, `package.json` | Startup/build and all tests; high impact | Conditional runtime correction only if demonstrated; no dependency upgrade or weakened validation presumed. |
| `tests/browser/support/profile-login-server.ts`, `tests/browser/profile-login-performance.spec.ts`, `playwright.login-performance.config.ts` | Existing ten timing cases and `tests/unit/runtime-boundaries.test.ts`; medium impact | Extend completion to table, capture timings on failure, preserve owned-server isolation; explicitly execute opt-in regression. |
| New `playwright.login-existing.config.ts`, new `tests/browser/profile-login-existing.spec.ts` | Controlled Chrome client of already-running 127.0.0.1:3000; medium impact | Dedicated configuration with no webServer, one worker, zero retries, real Chrome channel; reusable completion checks and actual-server matrix, never starts/stops the affected server. |
| `tests/unit/runtime-boundaries.test.ts`, `tests/integration/synthetic-route.test.ts`, `tests/integration/runtime-shell.test.tsx` | Boundary, duration, route, cookie and UI contracts; low impact | Add targeted checks after each changed testable layer; retain existing security cases. |
| `README.md` and stage evidence artifacts | Reproduction/verification instructions; low impact | Document exact commands, evidence limitations and causal findings. |

The role pages and their facade/session helpers supply readiness evidence; changing those pages, session caching or authorization requires a demonstrated cause and refreshed bounded plan under the effective approval fence. No database, repository schema, migration, new auth provider, deployment or unrelated refactor is planned.

## Implementation Steps

- [x] Step 1 — Prepare only the owned `/private/tmp` diagnostic harness described above; capture affected server/browser provenance and original-tab observation before measured profile exercises or mutations, then use that harness to collect the 30-flow baseline and attributed segments without diagnostic warming. Preserve repository source/output, fixture data and existing-browser cache state; do not depend on the later Step 5 spec/config. FR1.1–FR1.3, FR3.1–FR3.3, NFR1/NFR2.
- [x] Step 2 — Establish brownfield test baseline before source changes: supported Node 24/npm 11, existing full tests/coverage and required checks listed below, using owned isolated outputs where necessary to avoid active-server interference. Record any inability to isolate output as a blocker. Verify existing scoped Vitest/Playwright runner commands and configurations; no first executable test before runner readiness. FR5.1/FR5.2, NFR3.
- [x] Step 3 — Preview the exact proposed application diff and evidence linking it to the delayed segment. Implement the minimal attributed business/runtime layer correction first; then add/run happy-path and at least two applicable error/edge checks for each changed component in `tests/unit/runtime-boundaries.test.ts` or a colocated test. Omit inapplicable database/repository layers. FR2.1, FR4.1/FR4.2, NFR2.
- [x] Step 4 — If the attributed correction affects the session endpoint or frontend chain, preview and implement that layer, then update/run `tests/integration/synthetic-route.test.ts` and/or `tests/integration/runtime-shell.test.tsx` immediately after implementation. Cover all five identities, signed HttpOnly cookie rotation, malformed/unknown input, origin denial, sign-out, and profile isolation; retain authorization/revocation checks. Do not bypass protections to improve timings. FR2.1, FR4.1/FR4.2, NFR2.
- [x] Step 5 — Implement reusable table-based completion measurement and the explicit existing-server Chrome configuration/spec; then write/run its regression assertions, duration boundary and failure-recording tests. Extend `profile-login-performance.spec.ts` and its helper to include immediate business-page navigation and use the same completion contract. Verify both new configuration inclusion and existing opt-in suite inclusion, preserve retries 0/workers 1 and existing 80% coverage configuration. FR3.1–FR3.3, FR5.1/FR5.2, NFR1.
- [x] Step 6 — Run the actual-environment after matrix and compare all results with baseline and the measured correction, then run supporting isolated development/production timing cases. Run session/authorization regressions and serious/critical axe checks for the critical flow. If FR1.3 triggers, stop causal implementation and request the user's next reproduction step, preserving partial results. FR1.3, FR2.2, FR3/FR4/FR5, NFR1/NFR2.
- [x] Step 7 — Re-run full quality checks and compare counts/failures/coverage to baseline without lowering targets: formatter, linter, strict types, full tests, 80% line/branch/function coverage, security/dependency/SAST/secret checks, production build, deterministic start smoke, critical browser/a11y flow and canonical verification. Keep timing regression an explicit additional command. FR5.2, NFR3.
- [x] Step 8 — Write `code-summary.md`, `source-manifest.json` listing all changed application paths, `traceability.json` mapping each FR/NFR to code/tests/evidence or an explicit unresolved gap, and before/after evidence under this stage directory. Record revision, commands, outcomes, causal limits and rollback by reverting only owned changes. Reviewer/completion remain parent-owned. FR1–FR5, NFR1–NFR3.

## Test and Quality Check Plan

Exact targeted commands, fixture/mocking guidance and expected outcomes are in `unit-test-instructions.md`. Existing runner readiness command is the file-scoped Vitest command there. Existing-server execution uses the new config only after implementation and must target Chrome at `http://127.0.0.1:3000`; it has no server lifecycle hook. Existing-server timing precedes isolated supplemental checks. Full baseline and final checks use supported Node 24/npm 11: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run verify:security`, `npm run build`, `npm run smoke:start`, `npm run test:browser`, `npm run test:a11y`, `npm run verify:local`. These broad commands belong to whole-change quality verification, not scoped test instructions. Run build/start/browser commands only after preserving baseline and preventing output/port collision with the affected process; establish documented owned output configuration before execution. Missing isolation is a blocker, not authorization to overwrite `.next` used by that server.

Minimal adds one verifiable test per requirement and a happy-path floor per changed component, plus at least two applicable errors/edges per construction rules. Reuse meaningful existing assertions and add targeted regression at the narrowest level reproducing the defect; browser timing is necessary for this demonstrated boundary. Full suite, all production coverage floors and security/a11y gates remain mandatory. No new live integration is claimed.

## Assumptions & Open Questions

None. Runtime cause and actual-environment evidence are planned investigation work, not accepted assumptions. Lack of reproduction invokes FR1.3. Initial Plan Approval is required before source changes or test execution.

## Sources

Approved `requirements.md` and confirmed Q1/Q2; `src/runtime/synthetic/profiles.ts`; root, selector/shell and session route; role main pages/state components; current package/Vitest/Playwright configuration; approved CodeKB architecture/quality; active org/team/project/construction rules. Installed Next 16.3.6 guides read: `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` and `01-app/03-api-reference/04-functions/redirect.md`. Any eventual cache or Server Action change requires reading its additional relevant installed guide before implementation.

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
