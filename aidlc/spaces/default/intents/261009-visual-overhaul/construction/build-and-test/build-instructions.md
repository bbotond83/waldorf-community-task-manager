# Build Instructions: Visual overhaul and UX fixes

## Prerequisites

- Node 24.x and npm 11.x. The project's toolchain check (`scripts/validate-toolchain.mjs`) refuses any other major version, including Node 26, the default on this machine.
- On this machine put Node 24 first on the path for every command: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- No database, secrets or network services are needed. The app runs in synthetic mode with fictitious data.

## Dependency installation

`npm ci` (the lock file is committed). Do not add dependencies for this change; none were added.

## Environment setup

- `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1` are set by the Playwright config and the start-smoke script; for local development `npm run dev` reads `.env.local`.
- Brand images must exist at `public/brand/logo.png` and `public/brand/cover.jpg`. They are now tracked in git (staged); without them the pages still work but show empty image slots, and the NFR4 browser test fails.

## Build commands

1. `npm run lint`
2. `npm run format:check` (run `npx prettier --write <files>` first if it reports files)
3. `npm run typecheck`
4. `npm run build` (runs the toolchain check and the production runtime-config check first, then `next build`)

## Build verification

- `npm run build` exits 0 and lists all routes (static `/hozzaferes-megtagadva`, dynamic everything else) with the proxy (middleware) line.
- `npm run smoke:start` prints `SMOKE_START_OK: waldorf-local-ready` (starts the production build and polls `/api/readiness`).

## Troubleshooting

- `TOOLCHAIN_NODE_UNSUPPORTED: required Node 24.x`: Node 24 is not first on `PATH`; run the `export PATH=...` line above in the same shell.
- Playwright reports a missing browser: run `npx playwright install chromium firefox` once.
- Cover image looks soft or is missing: `next.config.ts` only allows image quality 75 (`images.qualities`); a `quality` prop with another value is ignored by Next 16.
- Port already in use for browser tests: the Playwright config starts three servers on ports 3100 to 3102 (`APP_PORT` shifts them); stop other servers on those ports.
