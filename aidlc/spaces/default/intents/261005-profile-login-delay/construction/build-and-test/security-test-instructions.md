# Security Test Instructions

## Setup
Run from `/private/tmp/waldorf-quality-final-261005`, verified copy with owned dependencies/output. Node 24/npm 11 via `/opt/homebrew/opt/node@24/bin` on PATH. APP_RUNTIME_MODE=synthetic; APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1; APP_PORT=4100; SMOKE_PORT=4210; CI unset. Existing server: http://127.0.0.1:3000. No dependencies changed, original server/output/browser cache reset. Snapshot .git reads original HEAD; dirty-source hashes identify tested code.

## Checks and Evidence Hygiene
Security/privacy/secrets/SAST/no-deploy/dependency commands execute within `npm run verify:local`, without duplicates. No high/critical dependency/SAST findings, secrets scans green. Integration/browser checks preserve origin, signed HttpOnly/Lax cookie rotation, expiry/tampering, role/scope/revocation/history/signout. Source-bound production private/no-store headers: ../code-generation/quality-final/production-headers.json (root/all five). Raw traces/HAR stay private tmp; export sanitized timings only, no cookie/token/body values. Real auth/RLS/scheduler/Vercel/Safari remain outstanding release prerequisites outside this synthetic-login bugfix; no deployment.
