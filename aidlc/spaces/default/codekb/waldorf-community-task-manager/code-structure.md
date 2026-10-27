# Code Structure

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`). The focused update rewrote "SQL migrations" and added "Database tests"; the `supabase/` and `tests/` rows of the layout table are updated. Other sections are kept from 2026-10-12 and do not show modules added since (for example `src/data/`, `src/identity/`, `scripts/db/`), which were not re-scanned.

## Top-level layout

| Path | Contents |
|---|---|
| `app/` | Next.js App Router: pages, layouts, server actions, API routes, `_lib` resolvers, `globals.css` |
| `src/` | Domain and application modules (14 modules at the 2026-10-12 scan; later additions not re-scanned) |
| `proxy.ts`, `next.config.ts` | CSP nonce proxy; security headers |
| `supabase/` | (2026-10-27) `config.toml` (local stack), `roles.sql`, `templates/` (Hungarian recovery e-mail), `migrations/` (39 SQL files) |
| `tests/` | `unit`, `integration`, `coverage`, `browser` (Playwright), `database` (2026-10-27: 55 files against the real local stack), plus `support` helpers |
| `scripts/` | `start-smoke.mjs`, `validate-runtime-config.ts`, `validate-toolchain.mjs`, `verification/*`; `db/*` (stack, migrate, worker, seed, reset, shuffled tests; skimmed 2026-10-27) |
| `verification/` | Manifests: `authorization-matrix.json`, `fixtures.json`, `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `AUTHORIZATION.md`, `RUNBOOK.md`, `reports/` |
| `source-materials/waldorf-community-app/` | PRD and workbook `Ovis tabla v2.xlsx` (17 sheets) |
| `.github/workflows/ci.yml` | CI |
| Config files | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright*.config.ts`, `.nvmrc` (24), `.npmrc`, `.env.example` |
| Docs | `README.md`, `HASZNALATI_UTMUTATO_HU.md`, `AGENTS.md` |

## src modules: ports and adapters (2026-10-12)

Counts: LOC (non-test) / src files / tests, as of 2026-10-12.

### src/application (2,439 / 14 / 8) - wired
- Files: `contracts.ts`, `authorization.ts`, `facade-pipeline.ts`, `idempotency.ts`, `evidence.ts`, `session-facade.ts`, `parent-facade.ts`, `teacher-facade.ts`, `admin-facade.ts`, `status-labels.ts`, `validation.ts`, `results.ts`, projection guard.
- Ports: `AdminApplicationPort.execute({actorId, operation, scope, payload})`, `ParentApplicationPort`, `TeacherApplicationPort.getSchedule`, `SessionGateway`, `AuthorizationVersionPort`, `IdempotencyStore`, `EventPublisher`, `EvidencePort`, `Clock`, `IdGenerator`.

### src/runtime (514 / 10 / 1) - wired
- `config.ts`, `composition.ts`, `types.ts`, `production/composition.ts`, `synthetic/{composition,profiles,access-state}.ts`, `session/session.ts`, `security/origin.ts`, UI shell components.

### src/parent-web, src/admin-core, src/admin-advanced, src/teacher-web - wired synthetic adapters
- In-memory ports on `globalThis[Symbol.for(...)]` stores with fixtures (see `component-inventory.md`).

### src/teacher-tracking - partly wired; src/access - mostly unwired
- `tracking-model.ts` live; `TeacherScheduleService` unwired. `src/access` live pieces: `types.ts`, `role-policy.ts`, `session-grants.ts`.

### Family B (unwired at 2026-10-12)
- `src/coordination`, `src/directory`, `src/import-migration`, `src/notifications`, `src/parent-experience`, `src/privacy-audit`, `src/admin-experience`: synchronous repository ports with in-memory implementations.

## app/ route inventory (2026-10-12)

- Pages: `/`, `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`; parent `/szulo/...`; admin `/admin/...`; teacher `/teacher/schedule(/[id])`; legacy redirects `/munkatars/beosztas(/[id])`.
- API: `/api/readiness` (GET), `/api/synthetic/session` (POST), `/api/synthetic/reset` (POST).
- Server actions: `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/belepes/actions.ts`, `app/meghivas/[token]/actions.ts`.

## SQL migrations (2026-10-27)

### Naming and ordering
- `supabase/migrations/<8 digits>_<snake_case_name>.sql`. The 8 digits start as a date (`20260806`, `20261006`) and continue as a running number past real calendar days (`20261035` to `20261045`). Files are applied in plain file-name sort order (`readMigrationFiles` sorts names, `scripts/db/runner.ts:30`).
- Four files share `20261035_` (`governance_list`, `integrity_directory_reads`, `integrity_lifecycle`, `placeholder_drop`); `migrations.test.ts` asserts that `20261035_placeholder_drop.sql` sorts last in U3.
- The last file is `20261045_audit_purge_isolation.sql`; the next free number is `20261046`.
- Each file opens with a comment naming the unit or follow-up, the rule ids (BR, NFR, FR) and, for a change to earlier objects, "Forward-only: the merged file(s) ... (is/are) not edited" and the list of changes.

### Unit map
| Files | Unit | Main objects |
|---|---|---|
| 20260806, 20261006 | baseline | `app_role_grants`, `app_authorization_versions`, conversion evidence, `has_*_scope` helpers |
| 20261012 | U1 platform | `platform_system_account`, `platform_caller_is_system`, `platform_actor_account`, `platform_actor_role`, `audit_events` + append-only trigger, `platform_audit_write`, `platform_touch_version`, `lifecycle_holds` |
| 20261013 | U1 platform | `idempotency_records`, `platform_result`, `platform_idempotency_check`, `platform_idempotency_store`, `platform_finish_operation`, `platform_cleanup_expired`, `lifecycle_hold_place`, `lifecycle_hold_release` |
| 20261014-20261023, 20261033 | U2 identity | accounts, sign-in attempts and lockout, sessions check, invitations, grants and account changes, privileges, password hook, group reach |
| 20261024-20261035 | U3 | directory, coordination, kernel sign-up/swaps/family, schedule, lifecycle, integrity fixes, placeholder drop |
| 20261036-20261043 | U4 | notifications schema/functions/hooks, import schema/functions/commit/dashboard, U4 repairs |
| 20261044 | U5 | `audit_purge`, relaxed `audit_events_refuse_change`, `identity_housekeeping` calls the purge |
| 20261045 | follow-up B1 | `audit_purge` capped at 5000 rows, purge isolated in a sub-transaction |

### Audit write call graph
- `platform_audit_write` (defined only in 20261012:94-108) is called by:
  - `platform_finish_operation` (20261013:90-92) for `success` and `denied`. Callers of `platform_finish_operation`: 20261013 (holds), 20261017 and 20261021 (invitations), 20261018 and 20261033 (grants, account changes), plus `identity_deny` (20261015:120-126), which 20261017, 20261018, 20261021, 20261030 and 20261033 use.
  - Direct, success only: 20261018:277 (`role.first_super_admin`), 20261029:677 and 682 (`approval.approve`/`approval.reject`), 20261032:172 and 178 and 20261035_integrity_lifecycle:119 and 125 (`lifecycle.anonymize`/`lifecycle.delete`, return value kept in `v_audit`), 20261041:438 (`import.commit`).
- Coordination, kernel sign-up/swaps, directory, notifications and import functions answer `platform_result('denied', ...)` without an audit event.

## Database tests (2026-10-27)

- Location `tests/database/`, runner `node --experimental-strip-types --test <files>`, real local Supabase stack (start with `npm run db:start`; connection from `scripts/db/common.ts` settings). 55 files: `*.test.ts` plus support modules `stack-support.ts`, `identity-support.ts`, `directory-support.ts`, `import-support.ts`, `notifications-support.ts`, `seed-support.ts`, `dataset.ts`, `fixtures/`.
- `stack-support.ts` exports: `openDatabase`, `lockSchemas` (advisory lock per schema so files sharing a schema run one at a time), `prepareSchema` (migrate `public` with the runner, or set up a worker schema), `ensureAccount` (real `auth.users`, `accounts`, `auth.sessions` rows), `seedGrants`, `asActor` (one transaction, `set local role`, JWT claims via `request.jwt.claims`), `failureOf`, `placeHold`, `useSchema`/`bindSchema`, `report` (TAP comment), and ids `ORGANIZATION`, `OTHER_ORGANIZATION`, `SUPER_ADMIN`, `PARENT`, `OUTSIDER`, `OTHER_ADMIN`, `SYSTEM_ACCOUNT`, `uuid(n)`.
- File shape (`audit.test.ts`, `audit-purge.test.ts`): `for (const schema of ["worker_1", "public"]) describe(...)`; `before`: `openDatabase`, `lockSchemas`, `prepareSchema`; `beforeEach`: `useSchema`, `resetWorkerData` (truncates every table of the schema), `seedGrants`. Aged rows are inserted through the owner connection with an explicit `occurred_at`, never by waiting.
- Registration: a file runs only when listed in an npm script (`test:database:stack`, `:identity`, `:directory`, `:notifications-import`, `:seed`, `:roles`) and in `scripts/db/shuffled-tests.ts`; `verify:local` runs all of them.

## Code patterns

- Erasable TypeScript only in code reachable from node tests or scripts (no enums, namespaces, constructor parameter properties).
- Result-state returns instead of exceptions for expected failures; in SQL, `platform_result(state, reference, code)`; unexpected failures raise with SQLSTATE codes (`28000`, `42501`, `22023`, `23505`).
- SQL (2026-10-27): `create or replace function ... language plpgsql security definer set search_path from current`, followed by `revoke all on function ... from public, anon, authenticated, service_role` and explicit grants.
- Hungarian route names and UI copy; English identifiers.
