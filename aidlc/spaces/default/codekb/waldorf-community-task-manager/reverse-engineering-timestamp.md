# Reverse Engineering Timestamp

## Run Metadata

- **Date**: 2026-10-06
- **Intent**: `261006-simplify-user-roles`
- **Repository**: `waldorf-community-task-manager`
- **Branch**: `feature/simplify-user-roles`
- **Observed commit**: `0dce0567f18dc72e46aa88d87e5626708b08bc7d`
- **Depth**: Standard
- **Requested breadth**: Full repository rescan; replace all nine documents.
- **Evidence source**: Current intent `inception/reverse-engineering/developer-scan.md`.
- **Execution**: Static scan/synthesis; no tests, build, browser, migration or target calls.

## Coverage Interpretation

Whole repository inventoried and source surfaces/role references examined; deep understanding is restricted to the exact paths below. Shallow directory entries cover remaining files beside specifically deep files. Only fully directory-analyzed components are declared deeply covered; deep individual files do not certify their entire component.

The refreshed developer scan binds the approved Git-access snapshot `git:eb4862559f80967f13a0cfcb4d9f0e3d571405b6` and store generation `sha256:76d1977d1018157bb1f74b43ea5498ec52c9b258ed20ade7e2b955dcc98cc6f2`. The final fingerprint `30b17c6daf49b37eea5f622f21905a0df9b26923` was minted over exactly the 53 analyzed paths below in that same approved access mode.

`tests/coverage/support/production-inventory.ts` was read deeply, but its scope fingerprint is unverifiable under the current `coverage/` ignore rule when the mint utility starts with an empty temporary index. It is tracked in the real index. Its findings remain in the quality assessment, and only its verified coverage claim is demoted to `shallow.paths`; no ignored path is silently omitted or claimed verified.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 261006-simplify-user-roles
fingerprint: 30b17c6daf49b37eea5f622f21905a0df9b26923
analyzed:
  paths:
    - package.json
    - README.md
    - .github/workflows/ci.yml
    - .gitignore
    - .npmrc
    - .nvmrc
    - .prettierignore
    - .prettierrc.json
    - next.config.ts
    - tsconfig.json
    - eslint.config.mjs
    - vitest.config.ts
    - playwright.config.ts
    - proxy.ts
    - src/access/
    - src/runtime/
    - src/application/authorization.ts
    - src/application/contracts.ts
    - src/application/facade-pipeline.ts
    - src/application/session-facade.ts
    - src/application/staff-facade.ts
    - src/directory/directory-service.ts
    - src/import-migration/import-service.ts
    - src/coordination/coordination-service.ts
    - src/coordination/types.ts
    - src/parent-experience/parent-experience-service.ts
    - src/notifications/notification-service.ts
    - src/notifications/durable-jobs.ts
    - src/privacy-audit/lifecycle-service.ts
    - src/admin-experience/admin-service.ts
    - src/staff-schedule/schedule-service.ts
    - src/staff-web/synthetic-staff.ts
    - app/api/
    - app/page.tsx
    - app/belepes/actions.ts
    - app/belepes/page.tsx
    - app/admin/_lib/session.ts
    - app/admin/layout.tsx
    - app/admin/import/layout.tsx
    - app/admin/advanced-actions.ts
    - app/admin/beallitasok/page.tsx
    - app/munkatars/_lib/session.ts
    - app/munkatars/layout.tsx
    - app/munkatars/beosztas/page.tsx
    - app/munkatars/beosztas/[id]/page.tsx
    - app/szulo/_lib/session.ts
    - supabase/migrations/
    - verification/AUTHORIZATION.md
    - verification/authorization-matrix.json
    - verification/fixtures.json
    - scripts/verification/scan-artifacts.ts
    - scripts/verification/run-local-verification.ts
    - scripts/verification/validate-manifests.ts
  components:
    - Access and Authorization
    - Runtime and Sessions
    - SQL Persistence Policies
shallow:
  paths:
    - tests/coverage/support/production-inventory.ts
    - src/application/
    - src/admin-core/
    - src/admin-advanced/
    - src/directory/
    - src/import-migration/
    - src/coordination/
    - src/parent-experience/
    - src/parent-web/
    - src/notifications/
    - src/privacy-audit/
    - src/admin-experience/
    - src/staff-schedule/
    - src/staff-web/
    - app/
    - scripts/
    - tests/
    - verification/
    - package-lock.json
    - playwright.login-existing.config.ts
    - playwright.login-performance.config.ts
    - HASZNALATI_UTMUTATO_HU.md
    - source-materials/
    - qa-results/
    - aidlc/
    - .aidlc-archive/
    - .codex/
    - .agents/
    - AGENTS.md
    - .env.example
    - next-env.d.ts
```
