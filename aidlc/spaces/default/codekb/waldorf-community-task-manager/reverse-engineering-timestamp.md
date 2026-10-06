# Reverse Engineering Timestamp

- Date: 2026-10-05.
- Observed commit: `85dab6b5c7762265357146a54e1612479e8c4302`.
- Intent: `261005-profile-login-delay`; source: its `inception/reverse-engineering/developer-scan.md`.
- Requested breadth: Full rescan; all nine artifacts replaced. Actual coverage: repository inventory with explicit deep implementation paths and shallow remaining UI/tests/reference material, at Minimal depth.
- Evidence: source inspection only. No delay reproduction, source correction, live-server timing, test execution, deployment, or real integration verification.
- Fingerprint mint returned `unknown` under the same default Git-access mode as the snapshot; commit identity alone does not establish scope freshness. Publication separately checks the supplied source snapshot.
- Ignored `.next/`, `node_modules/`, `coverage/`, `.verification/`, and `test-results/` contents are excluded from authored-code coverage. Existing unrelated edits and generated `next-env.d.ts` changes were preserved.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 261005-profile-login-delay
fingerprint: unknown
analyzed:
  paths:
    - src/access/access-service.ts
    - src/access/types.ts
    - src/access/in-memory-adapters.ts
    - src/access/supabase-route-adapter.ts
    - src/directory/directory-service.ts
    - src/directory/types.ts
    - src/directory/in-memory-directory-repository.ts
    - src/coordination/coordination-service.ts
    - src/coordination/types.ts
    - src/coordination/in-memory-repository.ts
    - src/notifications/notification-service.ts
    - src/notifications/durable-jobs.ts
    - src/notifications/in-memory-notifications.ts
    - src/parent-experience/parent-experience-service.ts
    - src/parent-experience/in-memory-parent-repository.ts
    - src/staff-schedule/schedule-service.ts
    - src/admin-experience/admin-service.ts
    - src/import-migration/import-service.ts
    - src/import-migration/in-memory-import-repository.ts
    - src/privacy-audit/lifecycle-service.ts
    - src/application/authorization.ts
    - src/application/contracts.ts
    - src/application/facade-pipeline.ts
    - src/application/idempotency.ts
    - src/application/results.ts
    - src/application/projection.ts
    - src/application/validation.ts
    - src/application/session-facade.ts
    - src/application/parent-facade.ts
    - src/application/staff-facade.ts
    - src/application/admin-facade.ts
    - src/application/evidence.ts
    - src/parent-web/synthetic-parent.ts
    - src/staff-web/synthetic-staff.ts
    - src/admin-core/synthetic-admin.ts
    - src/admin-advanced/synthetic-advanced.ts
    - src/runtime/config.ts
    - src/runtime/composition.ts
    - src/runtime/types.ts
    - src/runtime/AppShell.tsx
    - src/runtime/ProfileSelector.tsx
    - src/runtime/session/session.ts
    - src/runtime/security/origin.ts
    - src/runtime/synthetic/
    - src/runtime/production/
    - app/api/
    - app/page.tsx
    - app/layout.tsx
    - app/belepes/actions.ts
    - app/belepes/AuthenticationEntry.tsx
    - app/meghivas/[token]/actions.ts
    - app/szulo/_lib/session.ts
    - app/szulo/_lib/facade.ts
    - app/szulo/layout.tsx
    - app/szulo/actions.ts
    - app/szulo/feladatok/page.tsx
    - app/munkatars/_lib/session.ts
    - app/munkatars/_lib/facade.ts
    - app/munkatars/layout.tsx
    - app/munkatars/beosztas/page.tsx
    - app/admin/_lib/session.ts
    - app/admin/_lib/facade.ts
    - app/admin/layout.tsx
    - app/admin/page.tsx
    - app/admin/actions.ts
    - app/admin/advanced-actions.ts
    - scripts/
    - supabase/migrations/
    - .github/workflows/
    - proxy.ts
    - package.json
    - next.config.ts
    - tsconfig.json
    - vitest.config.ts
    - playwright.config.ts
    - playwright.login-performance.config.ts
    - eslint.config.mjs
    - .prettierrc.json
    - .npmrc
    - .nvmrc
    - .env.example
    - .gitignore
    - README.md
    - tests/browser/profile-login-performance.spec.ts
    - tests/browser/support/profile-login-server.ts
    - tests/unit/runtime-boundaries.test.ts
    - tests/integration/synthetic-route.test.ts
    - tests/integration/runtime-shell.test.tsx
    - tests/browser/runtime-foundation.spec.ts
    - tests/browser/parent-web.spec.ts
    - tests/browser/staff-web.spec.ts
    - tests/browser/admin-core.spec.ts
  components:
    - Access
    - Directory
    - Coordination
    - Notifications
    - Parent Experience
    - Staff Schedule
    - Admin Experience
    - Import Migration
    - Privacy Audit
    - Application
    - Parent Web
    - Staff Web
    - Admin Core
    - Admin Advanced
    - Runtime
    - App Routes
    - Local Verification
    - Supabase Schema
shallow:
  paths:
    - app/
    - src/
    - tests/
    - verification/
    - package-lock.json
    - aidlc/
    - source-materials/
    - HASZNALATI_UTMUTATO_HU.md
    - qa-results/
    - .aidlc-archive/
    - .codex/
    - .agents/
```
