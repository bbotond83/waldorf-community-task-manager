# Performance Test Instructions

## Environment and Data

Use locked installed dependencies, Node24/npm11 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Do not reinstall or upgrade. Build/start/browser use APP_RUNTIME_MODE=synthetic and APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1. All records are isolated invented fixtures; no live migration or backend linkage. Preserve existing thresholds, privacy, disabled deployment, private unsigned evidence and local next-env.d.ts (save/restore around generated build). PostgreSQL18 tools are installed locally. Run the approved disposable supported-schema migration/locking/RLS tests on invented data; no linked deployment is certified.

## Commands and Expected Results

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:login-performance
```

Run existing browser budgets including <2000ms first view from teacher/admin suites. Preserve configured login-performance budgets and fixture sizes. One bounded currently authorized source read per workflow, range <=31 elapsed days, zero denied reads and fresh refetch are checked by the scoped domain/integration suites. No production capacity/SLA claim.

## Current Execution Evidence

All applicable commands passed in this replay; see test-results.md and logs/attempt-2. Earlier failed evidence remains in attempt-1.
