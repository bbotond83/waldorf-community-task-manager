# Build Instructions

## Prerequisites

- Node 24.x and npm 11.x (`.nvmrc`; `npm run check:toolchain` checks it). In a shell with another Node, write `export PATH=/opt/homebrew/opt/node@24/bin:$PATH` before any `&&` chain.
- Docker, for the local database (`npm run db:start`). The Supabase stack publishes its ports on all interfaces; the start command refuses unless the owner acknowledges this (`DB_ALLOW_ALL_INTERFACES=1`) and treats the well-known default keys as reachable from the network while it runs.
- Playwright browsers installed (Chromium and Firefox; the mobile project emulates a Pixel 7 in Chromium; `npx playwright install`). The project defines no WebKit project..

## Dependency installation

```bash
npm ci
```

The versions of `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` are pinned (checked by `tests/unit/dependency-pins.test.ts`). `stylelint` 18.0.0 and `stylelint-config-standard` 41.0.0 check `app/globals.css`.

## Environment

The build needs a valid runtime configuration; the values below are build-only placeholders and contain no real secret:

```bash
export APP_SESSION_SECRET=$(openssl rand -hex 32) SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=build-only-public-key-placeholder
```

Browser specs run against the local database and the production build (Playwright starts `npm run start`), so run `npm run build` after every source change and before browser specs.

## Build

```bash
npm run build
```

Verification of the build: `npm run smoke:start` starts the production server and expects `SMOKE_START_OK`. The fonts are self-hosted WOFF2 files under `app/fonts/` (Vollkorn and Karla, two files each) and are served from the app itself (`font-src 'self'`).

## Static checks (all blocking)

```bash
npm run lint
npm run lint:css
npm run format:check
npm run typecheck
```

## Troubleshooting

- `CONFIG_PRODUCTION_INVALID: invalid SUPABASE_URL` or `APP_SESSION_SECRET`: export the three variables above before `npm run build` or `npm run start`.
- A browser spec reads old styles: the production build is stale; rebuild.
- `npm run db:start` refuses to start: the firewall acknowledgement flag is missing, or Docker is not running.
- Hungarian letters ő and ű look thin or different: a `fallback` option was added to a `next/font/local` call in `app/layout.tsx`. Remove it; `tests/unit/fonts.test.ts` and the sign-in typography spec guard this.
