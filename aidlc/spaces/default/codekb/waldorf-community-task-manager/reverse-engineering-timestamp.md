# Reverse Engineering Timestamp

## Run Record

- Date: 2026-10-12
- Commit: 80bd4f48a2ca395bd21a29f33e4b46e3b1bf4163
- Branch: feature/real-backend-local
- Run type: full rescan (all 9 artifacts replaced), intent 261012-real-backend-local, Comprehensive depth
- Executed during the scan: `npm run test:domain` (258 pass), Vitest delivery project (531 pass), migration 1 applied to a throwaway PostgreSQL 18.6 cluster (failed with a syntax error at `grant`)
- Skimmed, not read assertion by assertion: `app/**` page components, most of `tests/**`, `scripts/verification/{core,run-local-verification,scan-artifacts}.ts`, PRD heading list, workbook sheet list

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: 261012-real-backend-local
fingerprint: da80d0470aab3bf26bdf54bd670b3e8bc0b1e886
analyzed:
  paths:
    - ./
  components:
    - app
    - src/application
    - src/runtime
    - src/parent-web
    - src/admin-core
    - src/admin-advanced
    - src/teacher-web
    - src/teacher-tracking
    - src/access
    - src/coordination
    - src/directory
    - src/import-migration
    - src/notifications
    - src/parent-experience
    - src/privacy-audit
    - src/admin-experience
    - supabase/migrations
    - tests
    - scripts
    - verification
shallow:
  paths:
    - tests/browser/
    - scripts/verification/
    - source-materials/
```
