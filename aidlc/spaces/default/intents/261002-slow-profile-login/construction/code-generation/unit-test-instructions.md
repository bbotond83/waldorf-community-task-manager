# Test instructions — slow profile login

## Runner readiness and scope

Use Node 24.x/npm 11.x and installed lockfile dependencies. Verify `npm run check:toolchain`, Vitest configuration `vitest.config.ts` (delivery project/jsdom/`tests/setup.ts`) and installed Chromium launch before the first test. Do not install or change runner versions to hide failures. Every execution command below targets this defect. The conductor separately owns required full brownfield baseline and post-change suite/coverage and project-wide quality gates; these are not repeated per Unit because this directive has no Unit.

## Exact scoped commands

```bash
npx vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts
npx vitest run --config vitest.config.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx
npx playwright test --config playwright.login-performance.config.ts tests/browser/profile-login-performance.spec.ts --project=chromium --workers=1 --retries=0
npx playwright test --config playwright.config.ts tests/browser/runtime-foundation.spec.ts --workers=1 --retries=0
```

The first two commands use existing files/runners immediately after readiness. The dedicated performance config/spec/harness is a planned new frontend test delivered after any applicable layer implementation. It must execute both modes within one scoped run. A green rerun must not conceal a required failed timing sample. The existing critical flow uses existing built-server setup; build in synthetic mode before running it. Preserve the existing full coverage gate >=80% lines, branches and functions across production source; scoped tests do not claim whole-project coverage.

## Runtime and comparable measurement preparation

Use only synthetic local profiles: `parent-local`, `staff-local`, `group-admin-local`, `kindergarten-admin-local`, `super-admin-local`. For built artifacts, prepare `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run build`. The dedicated harness starts isolated loopback processes with `npm run dev -- --port <isolated-port>` and `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 APP_PORT=<isolated-port> npm run start` respectively, waits for `/api/readiness`, then loads the selector. The synthetic mode remains independent of `NODE_ENV`; do not activate synthetic controls in production runtime mode.

For baseline and post-change, use the same machine, Node/npm/browser versions, viewport, worker count, fixtures and launch flags. Give every first-use profile a fresh server and browser context. Prepare development compilation cache equivalently (separate empty framework dist directory per instance if supported by installed guides; otherwise document an equivalent authorized cache reset procedure), never label a warm persisted cache as cold. Production uses the same build preparation and fresh processes/context. No setup session POST or `/api/synthetic/reset` is allowed in first-use cases. Switch runs start from an established different profile and use the real switch selector flow. Shutdown each owned server and record stdout/compiler timing safely.

The installed Next CLI confirms development output lives in `.next/dev`; an existing user process owns that cache. Use validated `APP_LOGIN_TEST_DIST_DIR=.next/login-performance-<unique-run>` for a fresh dedicated development output instead. Unset it for production build/start. Do not move or delete another running server's cache. Apply the same measurement-only configuration to baseline and post-change. Bound readiness fetches with a timeout, detect an exited server immediately, and always terminate/reap only owned processes.

## Timer, functional and privacy assertions

A ready server and visible selector precede timing. Install a browser monotonic timestamp at the actual submit action, preserving it across navigation; stop after selected greeting and every authorized navigation control are visible and usable. Exclude driver scheduling before submission; include POST, 303, route compilation, navigation/render/hydration after submission. Assert each sample <=5000 ms (5000 passes, greater fails), with no averages masking failures. Use deterministic completion observations and ensure the timer assertion itself rejects an injected >5000 ms completion.

For each runtime record five isolated first selections plus five switch destinations individually. Check full expected navigation and absence of forbidden role links/protected projections; perform authorization-denial checks after the measured ready-state boundary. Extend route tests for all five valid selections, empty-ID sign-out, mode/origin/body/profile rejection; retain token rotation/signature/expiry/version and HTTP-only/SameSite protection tests. Do not mock the real browser POST/redirect/home flow. Unit tests may inject clocks and deterministic fixture values at existing ports; avoid shared mutable test state.

## Evidence and retained gates

Record machine/browser versions and equivalent cache preparation for baseline and post-change comparisons. Disclose mismatches and do not attribute unmatched timing differences to this change. Retain existing security checks and 80% quality gate.

Record per sample mode/profile/source-profile/first-or-switch/elapsed/functional result/cache preparation/readiness/tool versions and failures under this stage's evidence directory. Preserve strict typechecking, ESLint/Prettier, production build, deterministic start smoke, full existing tests/coverage, critical browser flow with no serious/critical axe findings, privacy/secret scans and high/critical dependency/SAST blocking checks. Unexecuted real integrations remain outstanding.
