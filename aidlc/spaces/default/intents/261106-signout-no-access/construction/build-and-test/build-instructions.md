# Build Instructions

## Prerequisites

- Node 24.x and npm 11.x (`npm run check:toolchain` verifies this).
- Docker running, for the local database stack.
- Dependencies installed: `npm install` (the lock file is the source of truth; `@axe-core/playwright` 4.13.0 and `@playwright/test` 1.62.1 are pinned).

## Environment setup

The build and the browser tests need the local stack's settings in the terminal. Run these from the project folder (one block, as `set -a` must apply to the later commands):

```bash
npm run db:start
set -a; . ./.env.database.local; set +a
export APP_SESSION_SECRET="$(openssl rand -hex 32)"
export APP_PUBLIC_URL="http://127.0.0.1:3100"
export SMTP_FROM="no-reply@example.test"
```

Use a port other than 3000 for any second server (the owner uses 3000). The browser tests use port 3100 by default.

## Build commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm run lint:css
npm run build
```

## Build verification

- `npm run build` ends with the route list and exit code 0.
- Without the environment variables above the build stops at once with `CONFIG_PRODUCTION_INVALID`; that is the designed pre-build check, not a failure of the code.

## Troubleshooting

- `Another next dev server is already running`: Next.js allows one dev server per project folder. Stop the other one, or run a copy of the project from a different folder on a different port.
- `ECONNREFUSED 127.0.0.1:54322` in a browser test: the database stack is not running; run `npm run db:start`.
- A browser spec fails the "empties and seeds its project's schema" unit test: the spec must call `bindSeededSchema()` from `tests/browser/support/seeded-schema.ts` (use `{ seed: false }` when it needs no records).
