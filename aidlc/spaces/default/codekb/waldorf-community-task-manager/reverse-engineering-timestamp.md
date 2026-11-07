# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-06
- Commit: 1672d981444bce3d9558b10e13e0a0a584df2dc6
- Branch: main
- Run type: focused scan, revision 1 of intent `signout-no-access` (record `261106-signout-no-access`), scope express. Merged into a STALE store: its last block (intent `stitch-design-update`, commit `251c4b3`) was kind partial. This run covers the no-access ("Nincs jogosultság") screens and their sign-out path: `app/_identity/`, the three role layouts and access states, `app/hozzaferes-megtagadva/`, `app/page.tsx`, `src/runtime/production/access.ts` and the shell pieces it uses, `src/identity/copy.ts` and `session.ts`, `proxy.ts`, and three `tests/coverage` files. The store moved forward by `78a0ab5` (sign-out and guidance on the denied states) and `1672d98` (restyle, PR #5); facts they changed are corrected in place and marked 2026-11-06.
- Analyzed deeply: the files listed in `analyzed.paths` below. Read in part: `tests/coverage/app-entrypoints.test.tsx` (lines 60-135 and a grep of the rest), `tests/coverage/parent-pages.test.tsx` (lines 228-257), `tests/coverage/app-session-boundaries.test.ts` (lines 25-60), `src/identity/session.ts` (whole file, read only as the sign-out and session basis).
- Skimmed, not read in full: `src/access/` (only the import sites and `index.ts`; `role-policy.ts` and `types.ts` named as the live pieces), `src/runtime/` other files, `app/szulo/`, `app/teacher/`, `app/admin/` other pages, `src/identity/` sign-in, cookies and service modules, `tests/coverage/` other files (grep only).
- Not opened: `supabase/`, `scripts/`, `src/application/` (only the `focusTarget` lines by grep), `src/data/`, `tests/browser/`, `tests/integration/`, `.github/`.
- Executed during the scan: nothing (read-only run; no tests, builds, linters or programs).
- Scope note: `analyzed.paths` lists the files actually read, not the whole focused list from the dispatch brief (`src/access/`, `src/identity/`, `src/runtime/`, `tests/coverage/` were only partly read). The rest is recorded as shallow so a later run does not treat it as verified.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: signout-no-access
fingerprint: 4569b26ef9e75effc97b1def5c3916de9adc5787
analyzed:
  paths:
    - app/_identity/
    - app/hozzaferes-megtagadva/page.tsx
    - app/page.tsx
    - app/szulo/layout.tsx
    - app/szulo/_lib/session.ts
    - app/szulo/_components/ParentAccessState.tsx
    - app/teacher/layout.tsx
    - app/teacher/_lib/session.ts
    - app/teacher/_components/TeacherAccessState.tsx
    - app/admin/layout.tsx
    - app/admin/_lib/session.ts
    - app/admin/_components/AdminAccessState.tsx
    - src/identity/copy.ts
    - src/identity/session.ts
    - src/runtime/production/access.ts
    - src/runtime/AppShell.tsx
    - src/runtime/BackToHomeLink.tsx
    - proxy.ts
    - tests/coverage/app-entrypoints.test.tsx
    - tests/coverage/parent-pages.test.tsx
    - tests/coverage/app-session-boundaries.test.ts
  components:
    - app
    - proxy.ts
    - src/identity
    - src/runtime
    - tests/coverage and tests/support
shallow:
  paths:
    - app/
    - tests/browser/
    - src/access/
    - src/identity/
    - src/runtime/
    - app/szulo/
    - app/teacher/
    - app/admin/
    - tests/coverage/
    - tests/integration/
    - tests/browser/support/
    - app/bejelentkezes/
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
```
