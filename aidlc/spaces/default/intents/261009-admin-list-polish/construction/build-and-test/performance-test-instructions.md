# Performance Test Instructions

## Scope

This change sets no new performance target. The unfiltered teacher schedule now reads one authorized schedule per granted group (sequentially) and merges the results; with two groups in the demo this is negligible, and the review recorded that parallel reads are not done (R-01). The existing login-time measurements remain the regression check.

## Targets

- No new numeric target. The profile login measurements in `tests/browser/profile-login-performance.spec.ts` keep their own thresholds (5000 ms); none were changed.

## How to run

- `npm run test:login-performance` (its own Playwright config and server, chromium).
- `playwright.login-existing.config.ts` targets an already running server on port 3000 with the Chrome channel; it is run only against a started server when that is wanted.

## Out of scope here

Load, latency percentile and throughput tests: nothing in this change touches those paths.
