# Reverse Engineering Timestamp

## Run Record

- Date: 2026-10-09
- Commit: 2cc6e42ebf799f1a985ef93a38250c71febe7ac7

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: admin-list-polish
fingerprint: 031a49e82ab81e1b3c69e56ed96613a6ec93884f
analyzed:
  paths:
    - app/
    - src/runtime/
    - src/application/
    - tests/
    - verification/
  components:
    - ScheduleFilter
    - ScheduleCollection
    - TeacherStatePanel
    - AdminFilterBar
    - AdminPagination
    - AdminBackLink
    - ResponsiveCollection
    - Admin record and task create pages
    - ParentDutiesPage
    - Status labels
    - Global stylesheet
    - AppShell
    - AppNav
    - BackToHomeLink
    - Synthetic profiles
    - Admin session
    - AdminMutationForm
    - Admin pages with demo-facing text
    - ParentDutyDetailPage
    - ParentRequestPages
    - ParentNotificationsPage
    - NotificationReadForm
shallow:
  paths:
    - package.json
    - vitest.config.ts
    - playwright.config.ts
    - next.config.ts
    - proxy.ts
    - .github/workflows/ci.yml
    - .env.example
    - HASZNALATI_UTMUTATO_HU.md
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
