# Security Test Instructions

## Environment and Data

Use locked installed dependencies, Node24/npm11 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Do not reinstall or upgrade. Build/start/browser use APP_RUNTIME_MODE=synthetic and APP_SYNTHETIC_FIXTURE_VERSION=waldorf-local-v1. All records are isolated invented fixtures; no live migration or backend linkage. Preserve existing thresholds, privacy, disabled deployment, private unsigned evidence and local next-env.d.ts (save/restore around generated build). PostgreSQL18 tools are installed locally. Run the approved disposable supported-schema migration/locking/RLS tests on invented data; no linked deployment is certified.

## Commands and Gates

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify:manifests
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run verify:security
```

Require no high/critical dependency/SAST finding, secret/privacy leak or deployment enablement. Scope, revoked/stale/unknown/malformed, mutation denial, field/redirect escaping and no downstream state changes are tested in approved scoped suites and browser checks. Run the approved disposable PostgreSQL18 test command below. Actual local fixture proof does not certify an unlinked production target. Do not execute a live migration.

## Evidence Boundaries

Inspect private pinned-action/14day artifact policy; no new signing infrastructure. Reports identify dirty source/HEAD and exact command logs, not committed-source attestation or remote CI execution. Static migration assertions and synthetic fixtures never establish real target enforcement.

## Disposable Database Verification

```bash
PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:database:roles
```

Private fresh socket/cluster, PostgreSQL18, no inherited target credentials; nine actual scenarios with timeout/cleanup and nonowner RLS. Application final-admin transaction checks remain separate fixture evidence.

## Current Execution Evidence

All applicable commands passed in this replay; see test-results.md and logs/attempt-2. Earlier failed evidence remains in attempt-1.
