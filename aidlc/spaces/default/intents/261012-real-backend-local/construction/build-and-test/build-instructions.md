# Build Instructions: Real local backend

## Prerequisites

- Node 24 and npm 11. On the owner's Mac: `export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` written before the `&&` chain (a leading `PATH=...` assignment would apply to the first command only).
- Docker Desktop installed and running (its licence check accepted).
- PostgreSQL 18 client tools (`brew install postgresql@18`); the role-migration test needs them.
- Playwright browsers (`npx playwright install` once) for the browser suite.

## Install

```
npm ci
```

## Local services (the owner starts them)

```
npm run db:start
```

The Supabase CLI publishes its ports on all network interfaces. `db:start` therefore checks that no non-loopback address answers and refuses to report success otherwise. The acknowledgement flag `DB_ALLOW_ALL_INTERFACES=1` is for the owner's trusted network only, on the `db:start` command only; it is never set by the assistant or in CI. `db:start` writes the ignored settings files (`.env.service.local` and the database address) that the database tests, the seed and the browser suite read.

Related commands: `npm run db:stop`, `npm run db:migrate`, `npm run db:worker -- --schema worker_1` (and `worker_2` to `worker_4`), `npm run db:seed`, `npm run db:seed:large`, `npm run db:reset` (on `public` it needs `--yes`).

## Build

```
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`npm run build` is `next build`. Build-only placeholder database settings are enough for the build itself (CI's SBOM job sets them); a running stack is only needed for the start smoke and the browser suite.

## Build verification

```
npm run smoke:start
```

Starts the production build, checks the readiness route and that the removed synthetic routes answer 404.

## All stages in one command

```
npm run verify:local
```

Runs, in order: toolchain, manifests, format, lint, typecheck, tests, database-roles, database-migrate, database-stack, database-identity, database-directory, database-notifications-import, database-seed, database-shuffled, coverage, security, build, bundle, smoke, browser. Each stage prints its output when it ends and writes it to `.verification/logs/<stage>.log`. Checks that need a hosted target are reported as outstanding evidence, not as passes.

## Troubleshooting

- `database-roles` stops with a missing `psql` or `pg_dump`: install PostgreSQL 18 client tools.
- `db:start` refuses to start: another program already answers on the stack's ports from a non-loopback address; stop it, or (owner only, trusted network) acknowledge with the flag.
- Database tests fail with a refusal naming the "local stack": the seed, reset and tests only run against the CLI's default local database password and a loopback address.
- The 2000-row import timing test failed once at 86.8 s on a loaded machine (ceiling 60 s). Re-run it alone; do not raise the ceiling.
- `swap-screens.test.tsx` failed once or twice under load; re-run the file alone to confirm. Planned fix: follow-up plan group C.
- The privacy scan only reads git-tracked or staged files; stage a new file before expecting the scan to see it.
