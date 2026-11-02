# Build instructions

## Prerequisites and environment

Use Node 24 first on the path and the installed lockfile dependencies (`npm ci` only when they are missing). The production build needs the local stack's settings in the environment (`.env.database.local`), a generated session secret and a local public address; without them the pre-build configuration check refuses, as designed.

## Build and verification

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && set -a && . ./.env.database.local && set +a && export APP_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") APP_PUBLIC_URL=http://127.0.0.1:3100 && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run smoke:start
```

## Troubleshooting

A `CONFIG_PRODUCTION_INVALID` message means a required setting is missing from the environment; load `.env.database.local` and set the two variables above. The build writes to `.next`; the development server uses `.next/dev`, so a running dev server is not disturbed.
