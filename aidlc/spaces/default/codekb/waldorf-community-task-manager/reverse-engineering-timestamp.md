# Reverse Engineering Timestamp

## Run Record

- Date: 2026-10-09
- Commit: f51c84477aacb9810ac4bda810a1e4952d259712

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 261009-functional-test-fixes
fingerprint: 1cc16c4e947810a8fb4cbcaedd590b584e6ab1a7
analyzed:
  paths:
    - app/
    - src/runtime/
    - src/application/
    - tests/
    - verification/
  components:
    - AppShell
    - AppNav
    - BackToHomeLink
    - Synthetic profiles
    - Admin session
    - ResponsiveCollection
    - AdminFilterBar
    - AdminMutationForm
    - Admin pages with raw demo-facing text
    - ParentDutiesPage
    - ParentDutyDetailPage
    - ParentRequestPages
    - ParentNotificationsPage
    - NotificationReadForm
    - Status labels
shallow:
  paths:
    - package.json
    - vitest.config.ts
    - playwright.config.ts
    - next.config.ts
    - proxy.ts
    - .github/workflows/ci.yml
    - .env.example
    - src/access/
    - src/admin-core/
    - src/admin-advanced/
    - src/admin-experience/
    - src/coordination/
    - src/directory/
    - src/import-migration/
    - src/notifications/
    - src/parent-experience/
    - src/parent-web/
    - src/privacy-audit/
    - src/teacher-tracking/
    - src/teacher-web/
    - scripts/
    - supabase/
```
