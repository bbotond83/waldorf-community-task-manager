# Performance Test Instructions

## Scope

This change sets no new performance target. The notification page now runs one extra client-side call after a task page opens from a notification, and the parent state sits on `globalThis`; neither is a measurable load path. The existing login-time measurements remain the regression check.

## Targets

- No new numeric target. The profile login measurements in `tests/browser/profile-login-performance.spec.ts` keep their own thresholds (5000 ms); none were changed.

## How to run

- `npm run test:login-performance` (its own Playwright config and server, chromium).
- `playwright.login-existing.config.ts` targets an already running server on port 3000 with the Chrome channel; it is run only against a started server when that is wanted.

## Out of scope here

Load, latency percentile and throughput tests: nothing in this change touches those paths.
