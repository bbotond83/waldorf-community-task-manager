# Code Structure

Full rescan, 2026-10-12, HEAD `80bd4f4`. 299 tracked files outside the AI-DLC install; `src` non-test TypeScript about 5,900 lines. One npm package, ES modules, `.ts` import extensions.

## Top-level layout

| Path | Contents |
|---|---|
| `app/` | Next.js App Router: pages, layouts, server actions, API routes, `_lib` resolvers, `globals.css` |
| `src/` | Domain and application modules (14 modules, see below) |
| `proxy.ts`, `next.config.ts` | CSP nonce proxy; security headers, optional `APP_LOGIN_TEST_DIST_DIR` |
| `supabase/migrations/` | Two SQL files; no `config.toml`, `seed.sql`, or tests |
| `tests/` | `unit`, `integration`, `coverage`, `browser` (Playwright), `database`, plus `support` helpers |
| `scripts/` | `start-smoke.mjs`, `validate-runtime-config.ts`, `validate-toolchain.mjs`, `verification/*` |
| `verification/` | Manifests: `authorization-matrix.json`, `fixtures.json`, `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `AUTHORIZATION.md`, `RUNBOOK.md`, `reports/` |
| `source-materials/waldorf-community-app/` | PRD (`waldorf-community-task-manager-prd-v1-en.md`) and workbook `Ovis tabla v2.xlsx` (17 sheets) |
| `.github/workflows/ci.yml` | CI |
| Config files | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright*.config.ts` (3), `.nvmrc` (24), `.npmrc` (`engine-strict`), `.env.example` |
| Docs | `README.md`, `HASZNALATI_UTMUTATO_HU.md`, `AGENTS.md` |

## src modules: ports and adapters

Counts: LOC (non-test) / src files / tests.

### src/application (2,439 / 14 / 8) - wired
- Files: `contracts.ts`, `authorization.ts`, `facade-pipeline.ts`, `idempotency.ts`, `evidence.ts`, `session-facade.ts`, `parent-facade.ts`, `teacher-facade.ts`, `admin-facade.ts`, `status-labels.ts`, `validation.ts`, `results.ts`, projection guard.
- Ports: `AdminApplicationPort.execute({actorId, operation, scope, payload})` (25 `AdminOperation` strings), `ParentApplicationPort` (8 methods), `TeacherApplicationPort.getSchedule`, `SessionGateway`, `AuthorizationVersionPort`, `IdempotencyStore` (sync `get/set/delete`), `EventPublisher`, `EvidencePort`, `Clock`, `IdGenerator`.
- Adapters: `InMemoryAuthorizationVersions`, `InMemoryIdempotencyStore`, `InMemoryApplicationJournal`.

### src/runtime (514 / 10 / 1) - wired
- `config.ts`, `composition.ts`, `types.ts`, `production/composition.ts`, `synthetic/{composition,profiles,access-state}.ts`, `session/session.ts`, `security/origin.ts`, UI shell `AppShell.tsx`, `ProfileSelector.tsx`, `AppNav`, `BrandMark`, `StatusBadge`.
- Port: `RuntimeComposition` union. Adapter: module-level `Map` of subject state; 4 profiles.

### src/parent-web (500 / 3 / 2) - wired adapter
- `synthetic-parent.ts` implements `ParentApplicationPort` as `SyntheticParentPort` with `Map`s of duties, notifications, contribution notes, requests on `globalThis[Symbol.for("waldorf.syntheticParentState")]`. 4 duty and 3 notification fixtures (plus test copies under `SYNTHETIC_TEST_COPIES=1`). `notification-context.ts` is pure. Hardcodes `parent-local`, `family-boroka`.

### src/admin-core (432 / 1 / 1) - wired adapter
- `synthetic-admin.ts`: `SyntheticAdminPort`; 5 records, 3 tasks, 4 approvals; store on `globalThis[Symbol.for("waldorf.admin-core.synthetic-store")]`.

### src/admin-advanced (511 / 2 / 1) - wired adapter
- `synthetic-advanced.ts`: `AdvancedWorkflowStore`; `CompositeAdminPort` routes 13 operations (import, reminders, governance, lifecycle, settings). Store on `globalThis[Symbol.for("waldorf.admin-advanced.synthetic-store")]`; `resetSyntheticAdvancedFixtures` also resets access state; `updateGrant` revokes subject access.

### src/teacher-web (229 / 3 / 2) - wired adapter
- `SyntheticTeacherScheduleAdapter`, `synthetic-teacher-repository.ts` (3 schedule rows, orgs `org-waldorf-local`, groups `group-oak`, `group-sunflower`), scenarios `ready/empty/denied/retryable/terminal`. Uses `TeacherScheduleRepository.readCurrent(query)` which may return a Promise.

### src/teacher-tracking (164 / 3 / 2) - partly wired
- `tracking-model.ts` (live: `TrackingEntry`, date-range rules, projection, scope match); `TeacherScheduleService` unwired. Ports: `ScheduleRepository`, `TeacherScheduleRepository`.

### src/access (692 / 8 / 6) - mostly unwired
- Files: `types.ts`, `access-service.ts`, `in-memory-adapters.ts`, `role-policy.ts`, `session-grants.ts`, `supabase-route-adapter.ts`, `index.ts`.
- Ports: `UserRepository`, `RoleGrantRepository`, `AuditWriter`, `AccessTransaction`, `ConversionStore` (all synchronous), `SupabaseClientPort` (async RPC).
- Used by Family A: `types`, `role-policy`, `session-grants`.

### src/coordination (49 / 4 / 1) - unwired
- `CoordinationRepository` (sync `transaction<T>(op)`), `CoordinationEvents`, `CoordinationAuditWriter`, `FamilyDirectory`; in-memory implementations. Sign-up capacity, swap auto-approval, assignment transitions.

### src/directory (251 / 4 / 2) - unwired
- `DirectoryRepository` (sync), `DirectoryAuditWriter`, `DirectoryAuthorizer`; families, parents, children, visibility rules, contact privacy. Only code-level `Family`, `Child`, `ParentProfile` types.

### src/import-migration (45 / 3 / 1) - unwired
- `ImportRepository` (sync): preview, fingerprint, conflict resolution, commit, rollback; `REQUIRED_SHEETS` and `LEGACY_DESTINATIONS` (17-sheet registry matching the workbook). No parser.

### src/notifications (27 / 4 / 2) - unwired
- `NotificationStore`, `NotificationJobQueue`, `EmailProvider`, `DurableJobRepository`, `DurableDispatcher`; 7-day/24-hour thresholds, job ids, provider idempotency. No scheduler.

### src/parent-experience (27 / 3 / 1), src/privacy-audit (8 / 2 / 1), src/admin-experience (13 / 2 / 1) - unwired
- `ParentRepository`/`ParentCommands`; `LifecycleRepository` (30-day rule, sync, audit write/list); `AdminRepository`/`Authorizer`/`AdminOperations`. `privacy-audit` and `admin-experience` have no in-memory adapter (test fakes only).

Test files in `src`: 32 colocated `*.test.ts` (258 `node:test` tests).

## app/ route inventory

- Pages: `/`, `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`; parent `/szulo/{ertesitesek, feladatok, feladatok/[id], feladatok/[id]/csere, feladatok/[id]/lemondas}`; admin `/admin` with `feladatok(/uj,/[id])`, `nyilvantartasok(/uj,/[id])`, `jovahagyasok(/[id])`, `archivum(/[id])`, `import`, `emlekeztetok`, `adatvedelem`, `beallitasok`; teacher `/teacher/schedule(/[id])`; legacy redirects `/munkatars/beosztas(/[id])`.
- API: `/api/readiness` (GET), `/api/synthetic/session` (POST), `/api/synthetic/reset` (POST).
- Server actions: `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/belepes/actions.ts`, `app/meghivas/[token]/actions.ts`.
- Per area `_lib/session.ts` and `_lib/facade.ts` (teacher also `filters.ts`).

## SQL migrations and what they cover

### 20260806_access_rls.sql (65 lines, historical baseline)
- Tables: `app_role_grants` (id, subject_id, role, scope_type, scope_id, organization_id, revoked_at), `app_authorization_versions` (subject_id, authorization_version default 1), and four thin tables `app_families`, `app_assignments`, `app_import_runs` (id, organization_id, scope_id), `app_audit_events` (plus `summary`).
- RLS on six tables; `auth.uid()`; helper functions `has_active_scope`, `has_admin_scope` (roles `super_admin`, `kindergarten_admin`, `group_admin`) alias the table as reserved `grant`: fails to apply on PostgreSQL.
### 20261006_current_roles.sql (140 lines, current roles)
- Single transaction, exclusive locks, requires `SET waldorf.authoritative_issuer_baseline = 'verified-v1'` else raises `INCOMPATIBLE_SCHEMA`. Preflight (types, duplicates, triggers, version default, role/scope pairs `UNSUPPORTED_ROLE_OR_SCOPE`, overflow); converts `read_only_staff` to `kindergarten_teacher`, `kindergarten_admin` to `super_admin`; writes `app_role_conversion_evidence`; adds CHECK constraints `current_role_scope`, `positive_authorization_version`; drops all policies and old functions; defines `authorization_version_for`, `has_current_role_scope`, `has_super_scope`, `has_core_scope`; execute grants to `authenticated` only; revokes insert/update/delete on grants, versions, evidence from `anon, authenticated`.
- Policies after: grants/versions readable by own subject; evidence by super admin; `app_families` read by core scope or parent whose family grant id equals the row id, write by core scope; `app_assignments` core scope only; `app_import_runs` super admin; `app_audit_events` read-only for super admin (no insert policy).

## Code patterns

- Erasable TypeScript only in code reachable from node tests or scripts (no enums, namespaces, constructor parameter properties).
- Result-state returns instead of exceptions for expected failures; `AdapterFailureClassifier` for unexpected ones.
- Synthetic stores on `globalThis[Symbol.for(...)]` to survive module duplication; `access-state.ts` is the exception (module-level `Map`).
- Hungarian route names and UI copy; English identifiers.
- Test and failure hooks inside production code: `scenario` fields (47 in `app/`), magic ids `duty-retry`, `duty-terminal`, `assignment-counterpart`, `restore-conflict`, `--scenario-<x>` suffixes, `SYNTHETIC_TEST_COPIES`.

## Synthetic-mode footprint (file grep, non-test)

Top counts: `src/admin-core/synthetic-admin.ts` 30, `src/parent-web/synthetic-parent.ts` 24, `src/runtime/synthetic/access-state.ts` 19, `src/runtime/config.ts` 18, `src/teacher-web/synthetic-teacher.ts` 13, `app/admin/_lib/session.ts` 13, `src/runtime/session/session.ts` 12, `README.md` 12, `src/application/session-facade.ts` 11, `src/admin-advanced/synthetic-advanced.ts` 11, both `app/api/synthetic/*/route.ts` 10-11, plus about 25 more files with smaller counts (CI workflow, verification core, `.env.example`, Hungarian guide). About 50 files in total.
