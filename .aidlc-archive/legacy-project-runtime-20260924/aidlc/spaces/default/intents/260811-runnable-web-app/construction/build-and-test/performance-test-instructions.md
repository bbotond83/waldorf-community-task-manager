# Performance Test Instructions

## Upstream Coverage

The Parent, Staff, Administrator Core, and Administrator Advanced NFRs require local synthetic critical operations to complete within two seconds on the versioned 30-family fixture. The matching Code Generation plans/summaries identify the browser scenarios and timing assertions.

## Method and Commands

- Run the critical browser suites with `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run test:browser` after production build.
- Record browser/project, route or operation, fixture version, viewport, start/end boundary, repetition count, and measured result from the test output.
- Verify pending feedback appears immediately, lists remain bounded, retries terminate in explicit states, and 320px/200% zoom retains permitted controls without two-dimensional scrolling.
- Run focused Playwright coverage for `tests/browser/parent-web.spec.ts`, `staff-web.spec.ts`, `admin-core.spec.ts`, and `admin-advanced.spec.ts` if the aggregate suite identifies a regression.

## Limits

These measurements cover local synthetic execution only. They do not establish Supabase, scheduler/provider, Safari, or hosted Vercel latency. This scope has no authorized external load target; do not send load to linked services.
