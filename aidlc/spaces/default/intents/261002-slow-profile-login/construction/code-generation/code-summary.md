# Profile login regression implementation

## Result and implementation decisions

The reported slow login was not reproduced in the required isolated baseline. All 20 first/switch samples across five profiles and ready development/built synthetic servers completed within 5000 ms. Development first-use was 248.7–354.5 ms and switches 102.4–117.4 ms; built first-use was 54.7–75.8 ms and switches 39.8–42.7 ms on this Apple M4 Pro/Node24.21.0/Chromium151 machine. This does not establish the cause of the user's previously observed delay or a speed improvement.

No login endpoint/header, session signing, runtime composition, profile form or home rendering correction is justified by these measurements. The delivered change protects the accepted behavior with timing, navigation/isolation and route/session regressions. `Clear-Site-Data` remains intact. An optional validated Next output directory isolates measurement from a pre-existing user development process; unset preserves normal output. Dedicated runner uses fresh dev cache/process/browser per profile, never primes the session/reset route, and is excluded from the existing browser suite.

## Files and test coverage

- `next.config.ts`: optional restricted `.next/login-performance-*` output for measurement servers.
- `playwright.login-performance.config.ts`, `tests/browser/profile-login-performance.spec.ts`, `tests/browser/support/profile-login-server.ts`: sequential development/built first-and-switch regression, browser submit timer, 5000 ms boundary, role navigation and denied-route checks, bounded owned server teardown and exact generated-type restoration.
- `playwright.config.ts`, `package.json`: dedicated suite excluded from standard browser flow and exposed as `npm run test:login-performance` (synthetic production build required).
- `tests/unit/runtime-boundaries.test.ts`: inclusive time boundary, over-budget/nonfinite/negative rejection, default/isolated/invalid Next output cases.
- `tests/integration/synthetic-route.test.ts`: all five profiles/cookie rotation/root destination, explicit sign-out and malformed-body rejection.

## Executed evidence and limitations

Baseline records and server logs are in `evidence/baseline-development.json`, `evidence/baseline-production.json` and matching logs. Root baseline:128 domain tests and271 delivery tests green; domain coverage floor green; production coverage94.18% lines/80.10% branches/92.30% functions; production build green;96 existing browser tests green including accessibility. Focused changed unit/integration checks:38 tests passed. Final typecheck passed after the final teardown correction and build.

The first diagnostic startup produced no usable timing evidence due shared generated-cache contention and a harness already-exited-child wait bug. The cache backup is retained; the user's development process was preserved. Isolated distDir fixed setup before the actual baseline. A first regression attempt had wrong denied-page locator assertions; the next had a macOS unsupported signal-0 teardown probe failure. These were test harness failures, not timing failures; `evidence/post-attempt-teardown-failure.json` retains the latter. The final hardened timing suite passed all10 cases (20 required samples) in45.8s. Post first/switch ranges: development303.6–354.7/108.1–139.9ms; built62.4–106.7/49.8–79.5ms. `evidence/post-timings.json` and `post-performance-report.json` retain every result and server output. `tsconfig.json` and `next-env.d.ts` have no remaining generated-test diff. Root post-change quality checks passed: 128 domain tests, 411 delivery tests; delivery coverage94.19% lines/80.17% branches/92.30% functions; lint, formatting, typecheck, synthetic production build, startup smoke, privacy/secrets/SAST/no-deploy scans and dependency audit (zero vulnerabilities). The existing browser suite passed96 tests across Chromium/Firefox/mobile including accessibility in54.8s. Durable exit results are in `evidence/post-checks.md`.

Baseline and post measurement preparation use the same machine/toolchain/browser/synthetic fixtures, worker count and empty dev output directory; production uses the same synthetic build. Browser regression includes extra usability checks compared with the initial diagnostic, so no causal before/after speed claim is made. Real integrations remain unverified.
