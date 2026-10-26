# Build Instructions: Audit purge isolation

## Prerequisites

- Node 24 and npm 11 (`export PATH=...` for the Node 24 install before the command chain).
- Docker running and the local stack started by the owner: `npm run db:start` (the owner sets the all-interfaces acknowledgement flag; the assistant never does).
- Stack settings in the environment: `set -a; . ./.env.database.local; . ./.env.service.local; set +a`.
- For the production build also `APP_SESSION_SECRET`, `APP_PUBLIC_URL=http://127.0.0.1:3000` and `SMTP_FROM`.

## Steps

```bash
npm ci
npm run db:migrate
npm run typecheck && npm run lint && npm run format:check
npm run build
```

`npm run db:migrate` applies `supabase/migrations/20261045_audit_purge_isolation.sql` to the default schema; the database tests apply it to their worker schemas themselves.

## Verification

- `db:migrate` prints `applied 20261045_audit_purge_isolation.sql` once and nothing on a second run.
- `npm run build` exits 0.

## Troubleshooting

- Database tests that all fail in milliseconds: Docker is not running or the stack settings are not loaded.
- `CONFIG_PRODUCTION_INVALID` at build: set `APP_SESSION_SECRET` as above.
