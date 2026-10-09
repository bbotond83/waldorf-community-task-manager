# Reverse Engineering Timestamp

## Run Record

- Date: 2026-10-09
- Commit: a031222a95546b83bad291eb061527774d3e068f

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 261009-navigation-polish
fingerprint: ebd1e98a41a8838509704631c5ce908d9b998c9b
analyzed:
  paths:
    - app/
    - src/runtime/
    - src/application/
    - tests/
    - package.json
    - vitest.config.ts
    - playwright.config.ts
    - next.config.ts
    - proxy.ts
    - .github/workflows/ci.yml
    - .env.example
  components:
    - AppShell
    - BrandMark
    - ProfileSelector
    - Synthetic profiles
    - Admin session
    - AuthorizationContract
    - ResponsiveCollection
    - AdminFilterBar
    - Admin dashboard
    - ParentDutiesPage
    - ParentNotificationsPage
    - NotificationReadForm
    - ScheduleCollection
    - Global stylesheet
shallow:
  paths:
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
    - verification/
    - supabase/
```
