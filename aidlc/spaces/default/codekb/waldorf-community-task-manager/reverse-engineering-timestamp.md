# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-04
- Commit: 251c4b33ec426d5dd0a80105388ed20683f8da44
- Branch: docs/design-md
- Run type: focused scan, revision 1 of intent `stitch-design-update` (record `261104-stitch-design-update`), scope classic, Standard depth, merged into a STALE store (kind partial, built by intent `no-access-signout`, whose last run covered commit `1070fd6`). This run covers the visual layer that a Google Stitch restyle touches: `app/` (`globals.css`, `layout.tsx`, every page and component that carries classes), `tests/browser/` (computed-style, size, layout and axe assertions that depend on the styles) and `proxy.ts` (the content security policy that governs fonts and styles). The store moved forward by `78a0ab5` (sign-out and Hungarian guidance on the denied pages, PR #3) and `251c4b3` (`DESIGN.md`); facts they changed are corrected in place and marked with the 2026-11-04 date. Prior prose from the earlier runs is kept and dated in each artifact. The analyzed paths and components below come from this run only; the earlier analyzed paths are demoted to shallow.
- Snapshot: the conductor holds the store generation and source fingerprint captured before the scan; the minted scope fingerprint below is the one the check command validates.
- Executed during the scan: nothing (read-only run; no tests, builds, linters or programs).
- Skimmed, not read in full: `src/runtime/` (class names used by `AppShell`, `AppNav`, `BrandMark`, `StatusBadge` only), `tests/integration/` and `tests/coverage/` (grep for class names), `package.json`, `next.config.ts`, `playwright.config.ts`, `.prettierignore`, `DESIGN.md`. Not opened: `supabase/`, `scripts/`, `src/application/`, `src/data/`, `src/access/`, `src/import-parser/`, `tests/database/`, `verification/`, `source-materials/`. The audit-area and identity files read in earlier runs are not re-read here; their sections are kept as written.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: stitch-design-update
fingerprint: 7294d0299d5bca21a48cb7ccc0d1e7a4601ab04e
analyzed:
  paths:
    - app/
    - tests/browser/
    - proxy.ts
  components:
    - app
    - proxy.ts
    - tests/browser
shallow:
  paths:
    - src/identity/
    - src/runtime/
    - tests/integration/
    - tests/browser/support/
    - app/bejelentkezes/
    - app/page.tsx
    - app/_identity/
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
  components:
    - src/identity
    - src/runtime
```
