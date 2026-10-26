# Build Instructions: Local password hint

## Prerequisites

Node 24 and npm 11 (`export PATH=...` for the Node 24 install before the command chain). For the production build also `APP_SESSION_SECRET`, `APP_PUBLIC_URL=http://127.0.0.1:3000` and `SMTP_FROM`; the changed code needs none of them.

## Steps

```bash
npm ci
npm run typecheck && npm run lint && npm run format:check
npm run build
```

## Verification

`npm run build` exits 0; `node --experimental-strip-types --test scripts/db/local-guard.test.ts` passes (18 tests).
