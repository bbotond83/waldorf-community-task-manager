# Reverse Engineering Timestamp

## Run Record

- Date: 2026-10-27
- Commit: 5d2b484d7b1ec7ad56286f503532016672bdde82
- Branch: ci/fit-free-actions-minutes
- Run type: focused scan of `supabase` and `tests/database` for intent `denied-audit-ratelimit` (record `261027-denied-audit-ratelimit`), Minimal depth, merged into a STALE store. Prior prose from the 2026-10-12 full rescan (intent `261012-real-backend-local`, commit `80bd4f48a2ca395bd21a29f33e4b46e3b1bf4163`) is kept and marked by date in each artifact; historical sections were condensed where the code they describe has since been replaced.
- Executed during the scan: nothing (read-only run; no tests, builds or programs).
- Skimmed, not read in full: the other migration files and database tests (grep), `scripts/db/` (runner, worker, shuffled tests), `scripts/verification/run-local-verification.ts`, `package.json`, `.github/workflows/ci.yml`, `src/data/gateway.ts`.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: denied-audit-ratelimit
fingerprint: c112b4194755852147a8751fc2c010bea5ba93cb
analyzed:
  paths:
    - supabase/migrations/20261012_platform_audit.sql
    - supabase/migrations/20261013_platform_idempotency.sql
    - supabase/migrations/20261015_identity_session.sql
    - supabase/migrations/20261019_identity_privileges.sql
    - supabase/migrations/20261044_audit_purge.sql
    - supabase/migrations/20261045_audit_purge_isolation.sql
    - supabase/config.toml
    - tests/database/stack-support.ts
    - tests/database/audit.test.ts
    - tests/database/audit-purge.test.ts
    - tests/database/migrations.test.ts
  components:
    - supabase/migrations
    - tests/database
shallow:
  paths:
    - ./
    - tests/browser/
    - scripts/verification/
    - source-materials/
    - supabase/migrations/
    - tests/database/
    - supabase/roles.sql
    - supabase/templates/
    - scripts/db/
    - src/data/gateway.ts
    - package.json
    - .github/workflows/ci.yml
```
