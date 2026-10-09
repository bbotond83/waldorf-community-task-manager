# Performance Test Instructions

## Scope

This change sets no new performance target. It does change what every profile does right after choosing it (a redirect to the default page instead of a welcome page), so the existing login-time measurements are the relevant regression check.

## Targets

- No new numeric target. The existing profile login measurements in `tests/browser/profile-login-performance.spec.ts` keep their own thresholds; none were changed.

## How to run

- `npm run test:login-performance` (its own Playwright config and server, chromium).
- `playwright.login-existing.config.ts` targets an already running server on port 3000 with the Chrome channel; it is run only against a started server when that is wanted.

## Out of scope here

Load, latency percentile and throughput tests: nothing in this change touches those paths.
