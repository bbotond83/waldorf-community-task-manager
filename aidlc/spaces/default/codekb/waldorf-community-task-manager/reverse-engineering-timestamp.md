# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-02
- Commit: 3456409d02aa63f3f5aeb0c1f3c07a1e95689932
- Branch: main
- Run type: focused scan, revision 2, for intent `empty-nav-after-login` (record `261102-empty-nav-after-login`), scope bugfix, Minimal depth, merged into a CURRENT store (kind partial, built earlier by this intent). Revision 1 covered the sign-in, shell and navigation area (`app/bejelentkezes/`, `app/page.tsx`, `app/_identity/`, `proxy.ts`, `src/runtime/`, `src/identity/`, `tests/browser/support/`, `tests/integration/`). Revision 2 (the human chose "Request Changes -> Also scan the audit area") adds the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database tests `stack-support.ts`, `audit.test.ts`, `audit-purge.test.ts`, `migrations.test.ts`. Prose from the 2026-10-12 full rescan and the 2026-10-27 focused update is kept and dated in each artifact; sections for the audit area were re-verified and extended, and the migration count was corrected from 39 to 40.
- Snapshot: store generation `sha256:5e33b959563c403dd13f55e942e88d1e757a95f85d5bbc9b1cb353eeb35db66d`, source fingerprint `git:8374ae9c603c0bf826d4e91c66fcf021857b6ca6`.
- Executed during the scan: nothing (read-only run; no tests, builds or programs).
- Skimmed, not read in full: the role layouts under `app/admin`, `app/szulo`, `app/teacher` and the teacher schedule page, the browser specs (grep), `app/jelszo-visszaallitas/` and `app/meghivas/` (grep), most `src/identity` and `tests/integration` files beyond their listing; of `supabase/migrations/` the other 34 files by name, and `20261046_audit_denied_rate_limit.sql` by header comment only (it exists at HEAD, redefines `platform_audit_write`, and was not in the approved paths); 54 other entries of `tests/database/` by name.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: empty-nav-after-login
fingerprint: 8374ae9c603c0bf826d4e91c66fcf021857b6ca6
analyzed:
  paths:
    - app/bejelentkezes/
    - app/page.tsx
    - app/_identity/
    - proxy.ts
    - src/runtime/
    - src/identity/
    - tests/browser/support/
    - tests/integration/
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
    - app
    - proxy.ts
    - src/runtime
    - src/identity
    - tests/integration
    - tests/browser/support
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
    - app/admin/
    - app/szulo/
    - app/teacher/
```
