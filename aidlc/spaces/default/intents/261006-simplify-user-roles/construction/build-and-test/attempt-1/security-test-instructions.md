# Security Test Instructions

## Environment and Data

Use locked installed dependencies, Node24/npm11 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Do not reinstall or upgrade. Build/start/browser use APP_RUNTIME_MODE=synthetic and APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1. All records are isolated invented fixtures; no live migration or backend linkage. Preserve existing thresholds, privacy, disabled deployment, private unsigned evidence and local next-env.d.ts (save/restore around generated build). Real PostgreSQL tools/target are unavailable; actual locking/RLS remains Unverified, with no later validation stage scheduled.

## Commands and Gates

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify:manifests
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify:security
```

Require no high/critical dependency/SAST finding, secret/privacy leak or deployment enablement. Scope, revoked/stale/unknown/malformed, mutation denial, field/redirect escaping and no downstream state changes are tested in approved scoped suites and browser checks. Actual SQL transaction/locking/RLS is Unverified: no psql/postgres/initdb/docker or authorized disposable target is available. Do not execute a live migration.

## Evidence Boundaries

Inspect private pinned-action/14day artifact policy; no new signing infrastructure. Reports identify dirty source/HEAD and exact command logs, not committed-source attestation or remote CI execution. Static migration assertions and synthetic fixtures never establish real target enforcement.
