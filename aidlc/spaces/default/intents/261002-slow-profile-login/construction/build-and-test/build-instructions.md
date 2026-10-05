# Build instructions

## Prerequisites and setup

Use Node 24.x/npm 11.x and the installed lockfile dependencies. In this workspace prefix commands with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Use synthetic local fixtures only.
For dependency setup use `npm ci` only when dependencies are missing; runner dependencies are already available. No database/provider service is required.

## Build and verification

```bash
APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run build
npm run typecheck
npm run lint
npm run format:check
npm run smoke:start
```

Preserve existing production-runtime controls; a production bundle in synthetic mode is the selected test environment. A missing supported toolchain or missing build output must be repaired before tests, without lowering gates.
