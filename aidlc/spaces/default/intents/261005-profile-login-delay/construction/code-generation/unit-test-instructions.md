# Profile Login Delay Test Instructions

## Setup and Configuration

Stage-level bugfix; Minimal strategy with additive targeted regression and existing suite preservation. Require Node 24/npm 11, installed locked dependencies, Vitest/jsdom and Playwright with real Chrome installed. Existing `vitest.config.ts` includes exact delivery files and 80% line/branch/function production coverage thresholds. Do not lower thresholds or test exclusions. Existing `playwright.login-performance.config.ts` opts into the ten isolated timing cases; standard Playwright/canonical verification exclude them, so explicit execution is mandatory.

Before source changes, capture the affected Chrome/server baseline and run the full quality baseline described in the plan. Verify the first exact scoped Vitest command below is runnable before executing any test cycle. Full baseline/final suite commands deliberately remain in the plan, not here. Testing Contract ordering is test-after: implement each applicable layer, then write/run that layer's tests. No opportunistic refactor is included.

The pre-change actual-server measurement uses an owned temporary diagnostic harness in `/private/tmp`, prepared only after initial Plan Approval, with the plan's exact timer/readiness/matrix contract. It uses installed Playwright without repository/application edits, server lifecycle operations, fixture resets or cache clearing. Retain its text/version and use the same harness before/after; port its contract into the regression files at Step 5. The new repository config/spec below is not needed to collect the baseline.

Add `playwright.login-existing.config.ts` for only `profile-login-existing.spec.ts`, real Chrome channel, baseURL `http://127.0.0.1:3000`, workers 1/retries 0 and no `webServer`. It attaches a controlled browser client to the already-running affected origin; existing-tab observation is separate and must precede this client. It must never start, stop, reset or warm the existing server. Preserve source manifest coverage for new config/spec/helper files.

## Exact Scoped Commands

Run from repository root with the supported toolchain. Commands below target this change's explicit test files only.

```sh
npx vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx tests/coverage/app-entrypoints.test.tsx
npx playwright test --config playwright.login-existing.config.ts tests/browser/profile-login-existing.spec.ts --project=chrome
npx playwright test --config playwright.login-performance.config.ts tests/browser/profile-login-performance.spec.ts --project=chromium
npx playwright test --config playwright.config.ts tests/browser/runtime-foundation.spec.ts tests/browser/parent-web.spec.ts tests/browser/staff-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --project=chromium
```

The first command exists before implementation. The second becomes runnable after the dedicated existing-server spec/config is implemented; define its project as `chrome`. The third explicitly executes the existing opt-in timing regression. The final command targets the existing critical-flow browser files confirmed in the workspace. Isolated production browser commands require the build/owned-server setup in the plan; do not collide with the affected server's output or ports. Browser traces may contain session data: sanitize recorded evidence before storing it under the intent.

## Required Tests and Acceptance

Use the five-ID/destination/readiness table and fixed 30-flow actual-server matrix in `code-generation-plan.md` unchanged. Exercise first route use before diagnostic warming, browser-cold first selections, retained-cache repeats and switches. Record every actual-server and isolated result, no retries or averages concealing >5000 ms. Supplemental development/production cases use existing owned server isolation with immediate main-page navigation added; isolated passing results do not close FR1/FR2.

At the narrowest effective level, cover FR1 evidence identity and failures, FR2 correction-specific positive/negative behavior, FR3 all five usable main pages, FR4 origin/session/authorization/profile isolation and FR5 explicit regression execution. Add at least one happy-path test per changed component and two applicable edge/error cases. Keep duration boundaries at 5000 passing/5001 failing; reject nonfinite/negative durations. A failed main request, loading/error panel, stale/wrong profile or disabled primary control cannot produce a successful timing record. Ensure failures retain elapsed/lower-bound and segment evidence.

Retain tests for HttpOnly/Lax cookie rotation, sign-out, malformed/unknown profile, cross/missing origin, expired/tampered signature, unauthorized main destination and dynamic admin revocation. Scope/role filtering and previous-profile absence remain necessary if browser/cache/navigation behavior changes. Execute serious/critical axe assertions in the critical browser flow and verify keyboard/focus/status behavior for any changed interactive UI. Keep Hungarian copy and stable semantic test IDs.

## Mocking and Test Data

Use existing invented fixture profiles and state; no real credentials/PII. Direct handler/component tests may stub runtime environment and deterministic clocks, restoring all stubs after each test. Real browser timing must not mock requests, auth, compilation, assets or readiness; do not use sleeps to hide missing usability. Never record raw cookie/token/header secrets. Never reset existing-server fixture/cache state before baseline; supporting owned servers may use controlled fixture isolation. If baseline fixture content fails the readiness table, treat it as a recorded blocker and follow FR1.3.

## Coverage and Evidence

Maintain >=80% lines, branches and functions across production source under existing full-coverage commands in the plan. Scoped test runs establish behavior, not full coverage compliance. Record exact command, revision/working delta, Node/npm/browser, origin/server/cache conditions, pass/fail counts and every timed attempt. FR1.3 prevents closure when the affected delay/server cannot be recovered; request the missing reproduction step instead of declaring an isolated regression a fix.
