# API Documentation

Full rescan, 2026-10-12, HEAD `80bd4f4`. There is no public JSON API; the application surface is HTML routes, server actions and three route handlers.

## HTTP route handlers

| Route | Method | Behaviour |
|---|---|---|
| `/api/readiness` (`app/api/readiness/route.ts`) | GET | Returns `{status, mode, marker: "waldorf-local-ready"}`; used by Playwright `webServer`, `scripts/start-smoke.mjs`, README |
| `/api/synthetic/session` (`app/api/synthetic/session/route.ts`) | POST form `profileId` | Same-origin check (`isSameOrigin`), sets signed cookie `waldorf_local_session`, 303 redirect to the profile home; `profileId=""` clears the cookie. Valid ids: `parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local` (zod enum) |
| `/api/synthetic/reset` (`app/api/synthetic/reset/route.ts`) | POST | 404 unless synthetic mode; resets access state, admin store, advanced store, parent state and parent facade cache; used by nine Playwright specs |
| `/munkatars/beosztas`, `/munkatars/beosztas/[id]` | GET | Legacy redirects to `/teacher/schedule` |

`proxy.ts` adds a per-request CSP nonce (`script-src 'self' 'nonce-...' 'strict-dynamic'`, `connect-src 'self'`, `form-action 'self'`, `upgrade-insecure-requests`; `unsafe-eval` only in development). Matcher excludes `/api`, static assets, prefetches. `next.config.ts` adds `X-Frame-Options`, `nosniff`, referrer and permissions headers. No authentication happens in the proxy.

## Server actions

`app/szulo/actions.ts` (parent duties), `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/belepes/actions.ts` (`authenticateParentAction`), `app/meghivas/[token]/actions.ts` (accept, `resendInvitationAction`). Each resolves session and facade through `_lib` and maps `ApplicationResult` to UI state.

## Internal application ports (the real contract surface)

### AdminApplicationPort (`src/application/admin-facade.ts`)
`execute({actorId, operation, scope, payload}) -> Promise<DomainOutcome<T>>` with 25 operations: `dashboard.get`; `records.{list,get,save,archive,restore}`; `tasks.{list,save}`; `assignments.assign`; `approvals.{list,decide}`; `notes.save`; `import.{preview,status,resolve,commit,recover}`; `reminders.{list,retry}`; `governance.{update,list}`; `lifecycle.{list,run}`; `settings.{get,save}`. `CompositeAdminPort` routes 13 (import, reminders, governance, lifecycle, settings) to `AdvancedWorkflowStore`.

### ParentApplicationPort (`src/application/parent-facade.ts`)
Eight methods covering duty list/detail, sign-up, swap request, cancellation request, notification list and read/acknowledge, contribution notes. Models: `DutyListItemModel` (states `available`, `full`, `ineligible`, `assigned`, `swap-pending`, `cancellation-pending`, with `version`); notification `timing` (`7-day`, `24-hour`, `within-threshold`, `stale`, `cancelled`).

### TeacherApplicationPort (`src/application/teacher-facade.ts`)
`getSchedule(...)` with scenario `ready/empty/denied/retryable/terminal`; repository seam `TeacherScheduleRepository.readCurrent(query)` (sync or Promise).

### SessionGateway (`src/application/session-facade.ts`)
`selectSynthetic`, `switchSynthetic`, `acceptInvitation(token, {})` (token min length 16), invitation resend (no-op).

### AuthorizationContract (`src/application/authorization.ts`)
`authorize(session, request) -> Promise<...>`; `navigation(session)`; `HOME_PATH_BY_ROLE`; matrix `four-role-v1` rows: `AUTH-PARENT-DUTIES`, `AUTH-PARENT-NOTIFICATIONS`, `AUTH-TEACHER-TRACKING`, `AUTH-GROUP-ADMIN-CORE`, `AUTH-GRP-IMPORT-DENY`, `AUTH-SUPER-ADMIN`, `AUTH-SUPER-GOVERNANCE`. Outcomes: allowed, `denied`, `invalidated("AUTHORIZATION_VERSION_STALE")`, `denied("INVALID_SESSION_MODE")`.

### Result model (`src/application/results.ts`, `contracts.ts`)
12 states: `initial, loading, empty, validation, pending, success, denied, conflict, invalidated, dependency-failure-retryable, dependency-failure-terminal, recovery`, each with a `presentationCode`. `FacadePipeline.invoke` order: authorize, validate, idempotency, domain invoke, project.

## Database-facing contracts

- `SupabaseClientPort` + `SupabaseRouteAdapter` (`src/access/supabase-route-adapter.ts`): RPC `authorization_version_for` and `has_current_role_scope(role, org, scope_type, scope_id)`; async, unused.
- SQL functions after migration 2: `authorization_version_for` (self only), `has_current_role_scope`, `has_super_scope(org)`, `has_core_scope(org, group)`; execute granted to `authenticated` only.
- Writes to grants, versions and evidence are server-only (privileges revoked from `anon`, `authenticated`).

## Configuration contract (`src/runtime/config.ts`)

`APP_RUNTIME_MODE` (`synthetic` | `production`, else `CONFIG_RUNTIME_MODE_INVALID`); synthetic: `APP_SYNTHETIC_FIXTURE_VERSION` (regex, default `waldorf-local-v1`, error `CONFIG_SYNTHETIC_INVALID`); production: `APP_SESSION_SECRET` (min 32), `SUPABASE_URL` (https only), `SUPABASE_ANON_KEY` (min 20), error `CONFIG_PRODUCTION_INVALID`. Other variables: `APP_HOST`, `APP_PORT`, `SYNTHETIC_TEST_COPIES`, `APP_LOGIN_TEST_DIST_DIR`, `NODE_ENV`.
