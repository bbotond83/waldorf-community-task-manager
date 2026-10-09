# Security Test Instructions

## Scope

No authentication, authorization, data or API behaviour changed. The security-relevant surface of this change is limited to static assets and the image optimizer, so the checks are the project's standard gates plus a confirmation that the content security policy is unchanged.

## Commands

- `npm run verify:security` runs, in order: privacy scan, secrets scan (`SECRETS_SCAN_PASS`), SAST (`SAST_SCAN_PASS`), no-deploy scan, and `npm audit --audit-level=high` (blocks on high and critical findings).
- Content security policy: `proxy.ts` is unchanged by this work; `img-src 'self' blob: data:` and `font-src 'self'` still hold, so the new images must stay local and no remote font may be added. Confirm with `git diff --stat proxy.ts` (expect no output).
- `next.config.ts` change: only `images.qualities: [75]`; it adds no `remotePatterns` or `domains`.

## Expected result

All scans pass and `npm audit` reports 0 high or critical vulnerabilities. The access checks in the existing browser and unit tests stay green.
