# Build Instructions

## Scope and Inputs

This guide validates the integrated implementation represented by every unit's `code-generation-plan.md` and `code-summary.md` under `construction/<unit>/code-generation/`. The seven units form one Next.js modular monolith; build and run from the repository root.

## Prerequisites and Environment

- Node.js 24.x and npm 11.x (`.nvmrc` and `package.json` engines define the baseline).
- Install locked dependencies with `npm ci` on a fresh checkout.
- For local acceptance, copy `.env.example` to `.env.local` and set `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1`. Do not add target credentials; no real Supabase, provider, Vercel, staging, or production service is needed.
- Install Playwright Chromium and Firefox binaries when running browser acceptance: `npx playwright install chromium firefox`.

## Build and Runtime Commands

1. `npm run check:toolchain` — verify Node/npm baseline.
2. `npm run verify:manifests` — validate scenario and authorization manifests.
3. `npm run format:check`, `npm run lint`, and `npm run typecheck` — enforce formatting, lint, and strict TypeScript.
4. `npm test` — run domain and delivery test suites.
5. `npm run test:coverage` — enforce the 80% line, branch, and function coverage floor.
6. `npm run verify:security` — run privacy, secret, SAST, no-deploy, and high/critical dependency checks.
7. With synthetic environment set, `npm run build` — produce the production Next.js output.
8. With synthetic environment set, `npm run smoke:start` — start the built server on loopback, probe readiness/root, and clean up the child process.
9. With synthetic environment set, `npm run test:browser` — run critical Chromium, Firefox, and mobile Chrome flows against isolated loopback production servers.

## Verification and Troubleshooting

The command sequence is recorded in `test-results.md`. If a command fails, retain its first failure output, identify whether the failure is toolchain, application, environment, or browser provisioning, then rerun only the failed step after a fix. Browser tests need installed browser binaries and permission to launch local browser processes. Do not use the aggregate `npm run verify:local` during this run: it clears `.verification/evidence` and `.verification/logs` before running, and those existing evidence files are being preserved. Run the equivalent commands above individually and retain their output in the stage record.
