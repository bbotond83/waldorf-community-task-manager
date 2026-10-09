# Build Instructions: Visual overhaul, second round

## Prerequisites

- Node 24.x and npm 11.x. The toolchain check (`scripts/validate-toolchain.mjs`) refuses any other major version, including Node 26, the default on this machine.
- On this machine put Node 24 first on the path for every command: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- No database, secrets or network services are needed. The app runs in synthetic mode with fictitious data.

## Dependency installation

`npm ci` (the lock file is committed). This change added no dependencies.

## Environment setup

- `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1` are set by the Playwright config and the start-smoke script; for local development `npm run dev` reads `.env.local`.
- Brand images `public/brand/logo.png` and `public/brand/cover.jpg` are tracked in git since the first visual overhaul.

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
- A browser spec fails right after profile selection: the app now lands on each profile's default page (Értesítések, Beosztás, Áttekintés) and no longer shows a welcome heading; wait for the default page's heading, not "Üdvözlünk".
- Ticking a notification checkbox before the page has hydrated does nothing; browser specs wait for the network to go idle first.
- Port already in use for browser tests: the Playwright config starts three servers on ports 3100 to 3102 (`APP_PORT` shifts them); stop other servers on those ports.
