# Integration Test Instructions

## Setup
Run from `/private/tmp/waldorf-quality-final-261005`, verified copy with owned dependencies/output. Node 24/npm 11 via `/opt/homebrew/opt/node@24/bin` on PATH. APP_RUNTIME_MODE=synthetic; APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1; APP_PORT=4100; SMOKE_PORT=4210; CI unset. Existing server: http://127.0.0.1:3000. No dependencies changed, original server/output/browser cache reset. Snapshot .git reads original HEAD; dirty-source hashes identify tested code.

## Commands and Acceptance
```sh
npx vitest run --config vitest.config.ts tests/unit/runtime-boundaries.test.ts tests/integration/synthetic-route.test.ts tests/integration/runtime-shell.test.tsx tests/coverage/app-entrypoints.test.tsx
npx playwright test --config playwright.config.ts tests/browser/runtime-foundation.spec.ts tests/browser/parent-web.spec.ts tests/browser/staff-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/admin-advanced.spec.ts --project=chromium
npm run test:a11y
```
Synthetic data only. Require cookie rotation, malformed/origin/expiry/tamper denial, signout/history, role/scope and revocation checks green; zero serious/critical axe findings. Scoped browser/axe commands follow canonical build. Overlapping counts are separate command executions, never additional distinct tests.
