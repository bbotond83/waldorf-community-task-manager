# Integration Test Instructions

## Upstream Coverage

These boundary tests verify the integration contracts described by every unit's Code Generation plan and summary: runtime composition to application façades, façades to existing domain ports, server routes/actions to authorized projections, shared synthetic fixtures, and evidence aggregation.

## Framework and Commands

- React/component and route-boundary integration tests use Vitest with jsdom: `npm run test:delivery`.
- Critical cross-unit browser journeys use Playwright: `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run test:browser`.
- Browser projects are Chromium, Firefox, and mobile Chrome. Each uses its own loopback production server and one worker to isolate process-global fixtures.
- Before browser runs, build with `APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run build`; install required browsers with `npx playwright install chromium firefox`.

## Required Boundaries

Cover Parent duty/request/notification, Staff read-only schedule, scoped administrator records/approval, advanced import/recovery/governance, role switching and next-request revocation, direct-denial behavior, privacy-safe rendering, keyboard/focus and serious/critical axe findings. Keep linked-target checks OUTSTANDING until executed against real Supabase/provider/Vercel targets.
