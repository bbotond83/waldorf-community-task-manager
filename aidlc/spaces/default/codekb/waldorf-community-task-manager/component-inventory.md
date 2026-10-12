# Component Inventory

Full rescan, 2026-10-12, HEAD `80bd4f4`. Wiring column: Wired = called by `app/`; Unwired = referenced only by itself and tests.

## Summary table

| Component | Wiring | Responsibility | Depends on |
|---|---|---|---|
| app | Wired | Pages, layouts, actions, API routes, session/facade resolvers | src/runtime, src/application, adapters |
| src/application | Wired | Authorization, pipeline, idempotency, result model, facades | src/access (types, role-policy, session-grants), src/teacher-tracking |
| src/runtime | Wired | Config, composition, session cookie, synthetic profiles, UI shell | src/application |
| src/parent-web | Wired | In-memory parent port | src/application |
| src/admin-core | Wired | In-memory admin port | src/application |
| src/admin-advanced | Wired | In-memory import/reminder/governance/lifecycle/settings | src/application, src/runtime (access state) |
| src/teacher-web | Wired | Teacher schedule adapter | src/application, src/teacher-tracking |
| src/teacher-tracking | Partly wired | Tracking model plus unwired service | none |
| src/access | Mostly unwired | Access service, grants, RPC adapter | none |
| src/coordination | Unwired | Sign-up/swap domain service | none |
| src/directory | Unwired | Families/children/parents | none |
| src/import-migration | Unwired | Import service, 17-sheet registry | none |
| src/notifications | Unwired | Reminder thresholds, durable jobs | none |
| src/parent-experience | Unwired | Parent read model | none |
| src/privacy-audit | Unwired | Retention lifecycle | none |
| src/admin-experience | Unwired | Admin authorization shell | src/import-migration |
| supabase/migrations | Not applied by app | Two SQL migrations | PostgreSQL, Supabase auth schema |
| tests | Verification | Five test layers | all |
| scripts | Tooling | Config validation, toolchain, smoke, local verification, disposable DB | node, psql |
| verification | Tooling data | Manifests and runbooks | scripts |

## Component details

### app
Next.js route tree (see `code-structure.md`); 5 server action files; layouts gate admin/teacher by redirect, parent by access panel. 47 `scenario` hook occurrences. Depends on `composeRuntime` per request.

### src/application
Facades (`parent`, `teacher`, `admin`, `session`), `FacadePipeline`, `AuthorizationContract`, `InMemoryAuthorizationVersions`, `InMemoryIdempotencyStore`, `InMemoryApplicationJournal`. Ports: `AdminApplicationPort`, `ParentApplicationPort`, `TeacherApplicationPort`, `SessionGateway`, `AuthorizationVersionPort`, `IdempotencyStore`, `EventPublisher`, `EvidencePort`, `Clock`, `IdGenerator`. 14 files, 8 tests.

### src/runtime
`validateRuntimeConfig`, `composeRuntime`, `RuntimeComposition`, cookie signing `session.ts`, `isSameOrigin`, 4 synthetic profiles, `access-state.ts` module-level Map, `AppShell`, `ProfileSelector`, `AppNav`, `BrandMark`, `StatusBadge`. Production composition unlinked stub. 1 test file in `src` (more in `tests/`).

### src/parent-web
`SyntheticParentPort` (state in `globalThis[Symbol.for("waldorf.syntheticParentState")]`), `createSyntheticParentFacade`, pure `notification-context.ts`. Hardcodes `parent-local`, `family-boroka`; notifications global.

### src/admin-core
`SyntheticAdminPort` with 5 records, 3 tasks, 4 approvals; `getSyntheticAdminPort()`, reset function. Fake `assign` and `saveNotes`; dashboard `openImportConflicts` always 0.

### src/admin-advanced
`AdvancedWorkflowStore`, `CompositeAdminPort`, `createSyntheticAdvancedAdminFacade`, `isSyntheticAdvancedSubjectRevoked`, `resetSyntheticAdvancedFixtures`. 3 reminder jobs, 3 grants, 3 lifecycle candidates, 2 recipients, preview `preview-waldorf-v1` (30 rows, 1 conflict, fingerprint `sha256:waldorf-advanced-v1:8b12`, commit 3 imported / 1 skipped).

### src/teacher-web
`SyntheticTeacherScheduleAdapter`, `SYNTHETIC_SCHEDULE` (3 rows), `TEACHER_GROUPS`, `TEACHER_FIXTURE_VERSION="teacher-tracking-local-v1"`. Cleanest promise-capable repository seam.

### src/teacher-tracking
`TrackingEntry`, `TrackingSourceRecord`, date range rules, projection, scope match (live); `TeacherScheduleService` (unwired); ports `ScheduleRepository`, `TeacherScheduleRepository`.

### src/access
`AccessService`, `convertLegacyRoles`, `InMemoryUserRepository`, `InMemoryRoleGrantRepository`, `InMemoryAuditWriter`, `InMemoryAccessTransaction` (throws `ASYNC_TRANSACTION_UNSUPPORTED` on promises), `SupabaseRouteAdapter`. Live pieces: `types.ts`, `role-policy.ts`, `session-grants.ts`.

### src/coordination
`CoordinationService`, `InMemoryCoordinationRepository`, `InMemoryCoordinationEvents`, `InMemoryCoordinationAuditWriter`.

### src/directory
`DirectoryService`, `InMemoryDirectoryRepository`, `InMemoryDirectoryAuditWriter`; `Family`, `Child`, `ParentProfile`.

### src/import-migration
`ImportService`, `InMemoryImportRepository`, `REQUIRED_SHEETS`, `LEGACY_DESTINATIONS`.

### src/notifications
`NotificationService`, `DurableNotificationJobs`, `InMemoryNotificationStore`, `EmailProvider` port.

### src/parent-experience
`ParentExperienceService`, `InMemoryParentRepository`; overlaps `parent-web`.

### src/privacy-audit
`PrivacyLifecycleService`, `LifecycleRepository`; no adapter.

### src/admin-experience
`AdminExperienceService`, `AdminRepository`, `Authorizer`, `AdminOperations`; no adapter.

### supabase/migrations
`20260806_access_rls.sql` (not applicable to real PostgreSQL, hash-pinned) and `20261006_current_roles.sql` (needs `waldorf.authoritative_issuer_baseline`). Only two files.

### tests
- `src/**/*.test.ts` 32 files, 258 node tests.
- `tests/unit` 11 files, `tests/integration` 15, `tests/coverage` 16 (Vitest, 531 tests, jsdom).
- `tests/browser` 11 specs (Playwright), `tests/browser/support/*`.
- `tests/database/current-role-migration.test.ts` (9 cases) with `tests/database/fixtures/current-role-baseline.sql`.
- `tests/coverage/support/production-coverage-reporter.ts`, `production-inventory.ts`.

### scripts
`validate-runtime-config.ts`, `validate-toolchain.mjs`, `start-smoke.mjs`, `verification/{core,run-local-verification,scan-artifacts,current-role-database,firefox-launch}.ts`.

### verification
`authorization-matrix.json`, `fixtures.json` (`waldorf-local-v1`, 30 families, `hu-HU`, `Europe/Budapest`), `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `RUNBOOK.md`, `AUTHORIZATION.md`.
