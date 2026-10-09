# Build Instructions

## Environment and Data

Use locked installed dependencies, Node24/npm11 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Do not reinstall or upgrade. Build/start/browser use APP_RUNTIME_MODE=synthetic and APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1. All records are isolated invented fixtures; no live migration or backend linkage. Preserve existing thresholds, privacy, disabled deployment, private unsigned evidence and local next-env.d.ts (save/restore around generated build). PostgreSQL18 tools are installed locally. Run the approved disposable supported-schema migration/locking/RLS tests on invented data; no linked deployment is certified.

## Commands

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH APP_RUNTIME_MODE=synthetic APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1 npm run build
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run typecheck
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run smoke:start
```

## Verification and Troubleshooting

Capture exits/logs. Restore the saved local-only next-env after build; preserve generated production route/root types at .next/dev/types if its local import requires them. No ignoreBuildErrors or strictness changes. Record unavailable tools and failed checks explicitly.

## Current Execution Evidence

All applicable commands passed in this replay; see test-results.md and logs/attempt-2. Earlier failed evidence remains in attempt-1.
