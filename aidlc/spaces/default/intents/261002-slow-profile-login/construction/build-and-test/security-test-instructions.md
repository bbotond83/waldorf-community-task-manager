# Security instructions

## Scope and commands

Use Node 24.x/npm 11.x and the installed lockfile dependencies. In this workspace prefix commands with `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Use synthetic local fixtures only.
```bash
npm run verify:security
```

This runs privacy, secret, SAST and no-deploy scans plus dependency audit. High/critical findings block delivery. Route/unit checks from Code Generation cover token rotation/signature/expiry/version, HttpOnly/SameSite, origin/body/profile rejection and production-runtime refusal. Browser tests cover role isolation and unauthorized access.

## Boundaries

No production authentication/provider integration or deployed DAST target is claimed. Cache clearing and all session controls remain unchanged. Synthetic runtime is separate from NODE_ENV. The restricted test distDir must not accept path traversal. No new secrets or deployment are required.
