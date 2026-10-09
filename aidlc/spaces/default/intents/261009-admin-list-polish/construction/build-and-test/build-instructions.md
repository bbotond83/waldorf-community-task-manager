# Build Instructions: Admin and schedule list polish

## Prerequisites

- Node 24.x and npm 11.x. The toolchain check (`scripts/validate-toolchain.mjs`) refuses any other major version, including Node 26, the default on this machine.
- On this machine put Node 24 first on the path for every command: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- No database, secrets or network services are needed. The app runs in synthetic mode with fictitious data.

## Dependency installation

`npm ci` (the lock file is committed). This change added no dependencies.

## Environment setup

- `APP_RUNTIME_MODE=synthetic` and `APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1` are set by the Playwright config and the start-smoke script; for local development `npm run dev` reads `.env.local`.
- `SYNTHETIC_TEST_COPIES=1` is set only by `playwright.config.ts` for its three test servers (per-browser demo copies for the parent specs). Never set it for a demo.

## Build commands

1. `npm run lint`
2. `npm run format:check` (run `npx prettier --write <files>` first if it reports files)
3. `npm run typecheck`
4. `npm run build` (runs the toolchain check and the production runtime-config check first, then `next build`)

## Build verification

- `npm run build` exits 0 and lists all routes with the proxy (middleware) line.
- `npm run smoke:start` prints `SMOKE_START_OK: waldorf-local-ready`.
- Wording check: a case-insensitive search for `rekord` over `app/`, `src/`, `tests/` and `HASZNALATI_UTMUTATO_HU.md` finds only identifiers, test ids, route names, comments and the two negative assertions.

## Troubleshooting

- `TOOLCHAIN_NODE_UNSUPPORTED: required Node 24.x`: Node 24 is not first on `PATH`; run the `export PATH=...` line above in the same shell.
- Playwright reports a missing browser: run `npx playwright install chromium firefox` once.
- The teacher schedule shows no entries on first visit: the page now starts unfiltered (all granted groups, no date limit); check the signed-in profile's group grants.
- A filter keeps a typed value after "Szűrők törlése": the clear control is a client component; without JavaScript it is a plain link and the page address decides what the fields show.
- Port already in use for browser tests: the Playwright config starts three servers on ports 3100 to 3102 (`APP_PORT` shifts them); stop other servers on those ports.
