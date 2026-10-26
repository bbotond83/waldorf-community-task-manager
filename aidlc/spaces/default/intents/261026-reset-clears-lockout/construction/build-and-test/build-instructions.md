# Build Instructions: Password reset clears the lockout

## Prerequisites

- Node 24 and npm 11 (`export PATH=...` for the Node 24 install before the command chain).
- For the production build and the browser suite also the local stack settings and `APP_SESSION_SECRET`, `APP_PUBLIC_URL=http://127.0.0.1:3000`, `SMTP_FROM` (the stack is started by the owner with `npm run db:start`). The changed code itself needs none of them.

## Steps

```bash
npm ci
npm run typecheck && npm run lint && npm run format:check
npm run build
```

## Verification

- `npm run build` exits 0.
- The unit tests of the changed file: `node --experimental-strip-types --test src/identity/reset.test.ts` (12 tests).

## Troubleshooting

- `CONFIG_PRODUCTION_INVALID` at build: set `APP_SESSION_SECRET` as above.
