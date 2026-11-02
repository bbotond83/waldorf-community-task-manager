# Build Instructions

## Prerequisites

- Node 24.x and npm 11.x (the project checks this at startup: `TOOLCHAIN_VALID`).
- The local database stack, started with `npm run db:start` (needed only for browser and database tests).

## Install and environment

```bash
npm ci
set -a; . ./.env.database.local; set +a
export APP_SESSION_SECRET="$(openssl rand -hex 32)"
export APP_PUBLIC_URL="http://127.0.0.1:3100"
export SMTP_FROM="no-reply@example.test"
```

Use a port other than 3000 when 3000 is in use (the browser tests default to 3100).

## Build

```bash
npm run build
```

## Build verification

```bash
npm run test:bundle     # seed module and service-role key absent from browser output
npm run smoke:start     # prints SMOKE_START_OK: waldorf-local-ready
```

## Troubleshooting

- A missing or invalid setting stops startup with a message that names the setting; `.env.example` lists every name.
- If the watcher reports `EMFILE`, start the dev server with `WATCHPACK_POLLING=true npm run dev`.
