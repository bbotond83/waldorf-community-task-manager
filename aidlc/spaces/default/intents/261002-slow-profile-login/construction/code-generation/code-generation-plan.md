# Code Generation Plan — slow profile login

Status: Ready for human Plan Approval. This zero-Unit Minimal bugfix has no synthetic Unit or Bolt. Implementation remains pending approval.

This Minimal bugfix implements the approved requirements in `inception/requirements-analysis/requirements.md` for all five local profiles, initial login and profile switching, in development and built production. Login completion means the usable home greeting and correct role navigation, measured from submission within 5000 ms after server readiness. Preserve secure sessions and profile isolation.

## Impact and diagnosis

The current focused CodeKB identifies browser cache clearing on successful profile selection as a candidate, not a measured cause. Inspect the exact login/session/navigation source and current tests, record a reproducible baseline, then select the smallest evidenced fix. Do not remove `Clear-Site-Data` without understanding and preserving its isolation purpose. Compare results only under documented equivalent browser, machine, and cache preparation; disclose unmatched conditions.

## Planned file surface and dependencies

| Exact path | Planned responsibility and impact |
| --- | --- |
| `app/api/synthetic/session/route.ts` | Conditional fix only if measurement supports session response/cache behavior; medium impact on selector, switch/sign-out and all roles. Preserve 303 root redirect and security outcomes. |
| `src/runtime/ProfileSelector.tsx`, `src/runtime/AppShell.tsx`, `app/page.tsx` | Inspect submit, sign-out/switch, greeting and navigation readiness. Conditional edits only if transport/rendering is measured as the cause; medium impact across five profiles. |
| `src/runtime/composition.ts`, `src/runtime/synthetic/composition.ts` | Inspect local composition and broad runtime imports; conditional narrower imports if first-use compilation/module work is evidenced. Shared consumers include readiness, reset and role facades. Never cache request-specific session output. |
| `src/runtime/session/session.ts`, `src/runtime/synthetic/profiles.ts`, `src/runtime/security/origin.ts`, `proxy.ts`, `next.config.ts` | Inspect preserved token/origin/role/CSP/dynamic boundaries; no speculative edits. |
| `tests/unit/runtime-boundaries.test.ts` | Retain/add happy-path and rotation/signature/expiry/version/mode checks as needed for changed runtime layer. |
| `tests/integration/synthetic-route.test.ts`, `tests/integration/runtime-shell.test.tsx` | Extend all-profile successful routes, sign-out and isolation/failure response assertions at changed endpoint/UI boundaries. |
| `tests/browser/profile-login-performance.spec.ts` (new) | Individual <=5000 ms first-use and switch-destination assertions, correct greeting/usable navigation and forbidden projection absence in both runtimes. |
| `playwright.login-performance.config.ts` (new), `tests/browser/support/profile-login-server.ts` (new) | Dedicated sequential synthetic server harness: fresh isolated instance/context per first profile; dev and built mode, no reset/session route warming, deterministic ports/teardown, timing evidence. |
| `tests/browser/runtime-foundation.spec.ts`, `playwright.config.ts`, `vitest.config.ts`, `package.json` | Inspect existing runners/security/accessibility gates; retain thresholds and existing critical flow. Dedicated timing config avoids changing existing suite semantics. |

No domain model, database, repository, provider, dependency or deployment change is planned. Source fix selection is intentionally deferred until the baseline identifies the delay within this bounded surface. If evidence requires a different scope, return to the conductor before editing outside it.

## Sequential steps

- [x] Step 1 — After human Plan Approval, inspect current source/test configurations and read installed Next.js routing, cookies, caching and development guides before code edits; verify Node 24/npm 11, Vitest and Playwright readiness. FR2, FR3.1, NFR3.
- [x] Step 2 — Before application changes, run the full existing brownfield suite and record pass/fail/skipped/coverage evidence. Diagnose existing browser login with an isolated ready instance/context for each profile and equivalent cache preparation in dev and built synthetic mode. Record POST/redirect/render/asset/compile observations and all first/switch times. FR3.1, FR3.3, NFR1.
- [x] Step 3 — Select and preview the smallest measured runtime/business-logic correction from the listed surface, if applicable; implement it, then write/run its scoped unit happy-path and boundary tests. Preserve local ports, token semantics and per-request authorization. FR1, FR2, NFR2.
- [x] Step 4 — Implement the endpoint response/transport correction only if applicable, then extend/run `tests/integration/synthetic-route.test.ts` with all five successes, 303/home destination, rotated secure-cookie properties, sign-out, invalid body/profile, origin and production-mode failures. FR1.1–FR1.3, FR2.1–FR2.3.
- [x] Step 5 — Implement the frontend correction only if applicable, then extend/run `tests/integration/runtime-shell.test.tsx` and create/run the dedicated profile-login browser regression/harness. First-use: fresh server/context for each profile without reset or session POST setup. Switches: each profile as a target from a different role; retain functional and authorization-denial checks. FR1, FR3.2, NFR1, NFR2.
- [x] Step 6 — Repeat identical cache/machine/browser preparation for post-change measurements; require every first/switch measurement <=5000 ms in both ready runtimes, including post-submit compilation. Verify the regression rejects >5000 ms even with correct content. Preserve build/start, browser/a11y, security and >=80% line/branch/function gates; run the full suite after changes. FR3.3, NFR1–NFR3.
- [x] Step 7 — Record actual source manifest, requirements traceability, implementation summary and evidence only after implementation; disclose failing/missing evidence and unmatched comparison conditions. FR3.3, NFR3.

## Baseline status and approval boundary

Execution adjustment: a pre-existing user development process owns `.next/dev`, so the dedicated measurement harness uses the optional validated `APP_LOGIN_TEST_DIST_DIR=.next/login-performance-<run>` Next output directory. Default development output is unchanged. This runner-isolation configuration is applied identically before baseline and after correction; it is not claimed as a login speed fix. Generated directories stay under already ignored `.next/`. Preserve the failed startup as setup evidence and do not move a live user cache.

No executable tests or login measurements have run in planning. Automatic execution review rejected a scripted read with `CODE_GENERATION_EXECUTION_INELIGIBLE` because Plan Approval is unanswered; ordinary read-only `cat` inspection and planning artifact writes were permitted. Baseline execution is the first approved execution work, before any application correction. Pending evidence does not establish cause or a five-second pass.

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
