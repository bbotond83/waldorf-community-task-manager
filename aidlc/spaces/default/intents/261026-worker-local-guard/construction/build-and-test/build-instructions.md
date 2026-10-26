# Build Instructions: Worker local-only guard

## Prerequisites

Node 24 and npm 11 (`export PATH=...` for the Node 24 install before the command chain). The real-stack tests need Docker, the local stack started by the owner (`npm run db:start`), and `set -a; . ./.env.database.local; . ./.env.service.local; set +a`. The production build also needs `APP_SESSION_SECRET`, `APP_PUBLIC_URL=http://127.0.0.1:3000` and `SMTP_FROM`.

## Steps

```bash
npm ci
npm run typecheck && npm run lint && npm run format:check
npm run build
```

## Verification

`npm run build` exits 0. Unit tests of the changed tooling: `node --experimental-strip-types --test scripts/db/tooling.test.ts scripts/db/local-guard.test.ts` (51 tests). Real-stack worker tests: `node --experimental-strip-types --test tests/database/worker.test.ts` (13 tests).

## Troubleshooting

- `db:worker` now refuses a database that is not the local stack (step `guard`). A stack started with a custom database password must be restarted with the Supabase CLI's default password.
