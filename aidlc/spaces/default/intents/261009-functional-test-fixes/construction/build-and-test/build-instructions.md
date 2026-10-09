# Build Instructions: Functional test fixes

## Prerequisites

- Node 24.x and npm 11.x. The toolchain check (`scripts/validate-toolchain.mjs`) refuses any other major version, including Node 26, the default on this machine.
- On this machine put Node 24 first on the path for every command: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- No database, secrets or network services are needed. The app runs in synthetic mode with fictitious data.

## Dependency installation

`npm ci` (the lock file is committed). This change added no dependencies.

## Environment setup

- `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1` are set by the Playwright config and the start-smoke script; for local development `npm run dev` reads `.env.local`.
- `SYNTHETIC_TEST_COPIES=1` (new) is set only by `playwright.config.ts` for its three test servers. It adds the per-browser demo copies the parent browser tests need for isolation. Never set it for a demo or any shared environment; without it the demo shows only the normal tasks and notifications.

## Build commands

1. `npm run lint`
2. `npm run format:check` (run `npx prettier --write <files>` first if it reports files)
3. `npm run typecheck`
4. `npm run build` (runs the toolchain check and the production runtime-config check first, then `next build`)

## Build verification

- `npm run build` exits 0 and lists all routes with the proxy (middleware) line.
- `npm run smoke:start` prints `SMOKE_START_OK: waldorf-local-ready` (starts the production build and polls `/api/readiness`).

## Troubleshooting

- `TOOLCHAIN_NODE_UNSUPPORTED: required Node 24.x`: Node 24 is not first on `PATH`; run the `export PATH=...` line above in the same shell.
- Playwright reports a missing browser: run `npx playwright install chromium firefox` once.
- Parent browser specs cannot find a "– Firefox próba" or "– mobil próba" entry: the server was started without `SYNTHETIC_TEST_COPIES=1`; run through `playwright.config.ts`, which sets it.
- A parent-state change survives `/api/synthetic/reset`: the parent state and facade cache live on `globalThis` since this change; restart the server if an old build is running.
- Port already in use for browser tests: the Playwright config starts three servers on ports 3100 to 3102 (`APP_PORT` shifts them); stop other servers on those ports.
