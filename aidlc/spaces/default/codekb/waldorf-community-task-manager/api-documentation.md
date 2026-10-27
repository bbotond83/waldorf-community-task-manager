# API Documentation

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`). The focused update rewrote "Database-facing contracts". The HTTP, server-action and application-port sections are kept from 2026-10-12 and were not re-scanned (the synthetic routes and ports they describe may since have changed).

## HTTP route handlers (2026-10-12)

| Route | Method | Behaviour |
|---|---|---|
| `/api/readiness` | GET | Returns `{status, mode, marker: "waldorf-local-ready"}`; used by Playwright `webServer`, `scripts/start-smoke.mjs` |
| `/api/synthetic/session` | POST form `profileId` | Same-origin check, sets signed cookie `waldorf_local_session`, 303 redirect; `profileId=""` clears the cookie |
| `/api/synthetic/reset` | POST | 404 unless synthetic mode; resets the in-memory stores |
| `/munkatars/beosztas`, `/munkatars/beosztas/[id]` | GET | Legacy redirects to `/teacher/schedule` |

`proxy.ts` adds a per-request CSP nonce; its matcher excludes `/api`. No authentication happens in the proxy.

## Server actions (2026-10-12)

`app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`, `app/belepes/actions.ts`, `app/meghivas/[token]/actions.ts`. Each resolves session and facade through `_lib` and maps `ApplicationResult` to UI state.

## Internal application ports (2026-10-12)

- `AdminApplicationPort.execute({actorId, operation, scope, payload}) -> Promise<DomainOutcome<T>>` with 25 operations (dashboard, records, tasks, assignments, approvals, notes, import, reminders, governance, lifecycle, settings).
- `ParentApplicationPort`: eight methods (duty list/detail, sign-up, swap, cancellation, notifications, contribution notes).
- `TeacherApplicationPort.getSchedule(...)`; `SessionGateway`; `AuthorizationContract.authorize(session, request)` with matrix `four-role-v1`.
- Result model: 12 states (`initial, loading, empty, validation, pending, success, denied, conflict, invalidated, dependency-failure-retryable, dependency-failure-terminal, recovery`). `FacadePipeline.invoke` order: authorize, validate, idempotency, domain invoke, project.

## Database-facing contracts (2026-10-27)

### Call envelope
- Application code calls named database functions over the data API (`src/data/gateway.ts`: `client.rpc(name, { ...args })`, skimmed). Every audited operation returns `jsonb` built by `platform_result(p_state, p_reference, p_code)` (20261013:23-26): `{state, reference, code}`. States stored for replay: `success`, `validation`, `denied`, `conflict`, `terminal`. The gateway maps `denied` to `{state: "denied", reference: null, code: "authorization_denied"}`.
- A replay with the same idempotency key and request fingerprint within 24 hours returns the stored state with code `replayed`; the same key with a different fingerprint returns `conflict` / `idempotency_key_reused`.

### Platform functions (internal, no application-role execute right)
| Function | File | Contract |
|---|---|---|
| `platform_audit_write(p_action text, p_target_type text, p_target_id uuid, p_organization_id uuid, p_group_id uuid, p_outcome text, p_details text) returns uuid` | 20261012:94-108 | Inserts one `audit_events` row with actor account and role from the session; returns the new id. `security definer`, `set search_path from current`. Revoked from `public, anon, authenticated, service_role` (20261012:109). The only writer of `audit_events`. |
| `platform_actor_account() returns uuid` | 20261012:18-31, redefined 20261015:51-67 | `auth.uid()` for an active session; nil system account for `postgres`/`service_role`/`supabase_admin`; raises `28000` (no user) or `42501` (inactive session). |
| `platform_actor_role(p_organization_id uuid) returns text` | 20261012:35-57 | Strongest active grant in that organization: `super_admin`, `group_admin`, `teacher`, `parent`; `system` for the system caller; `none` without a grant. |
| `platform_finish_operation(p_operation, p_key, p_fingerprint, p_action, p_target_type, p_target_id, p_organization_id, p_group_id, p_state, p_reference, p_code, p_details) returns jsonb` | 20261013:82-95 | For `success` or `denied` calls `platform_audit_write` (return value discarded); always calls `platform_idempotency_store`; returns `platform_result(p_state, p_reference, p_code)`. |
| `identity_deny(p_operation, p_key, p_fingerprint, p_action, p_target_type, p_target_id, p_organization_id, p_group_id, p_details) returns jsonb` | 20261015:120-126 | `platform_finish_operation(..., 'denied', null, 'authorization_denied', p_details)`. |
| `platform_idempotency_check(p_operation, p_key, p_fingerprint) returns jsonb` | 20261013:31-48 | Advisory transaction lock on `current_schema()|account|operation|key`; returns `{status: new | replay | conflict, ...}`. |
| `audit_purge() returns integer` | 20261044, capped in 20261045:15-32 | System caller only (`service_role` execute grant); deletes at most 5000 events older than 365 days, oldest first. |

### Audit table contract (`audit_events`)
- Columns, checks and indexes: see `architecture.md` "Platform audit write". Outcomes: `success`, `denied`. Actions (after 20261014): `role.grant`, `role.revoke`, `role.first_super_admin`, `approval.approve`, `approval.reject`, `import.commit`, `lifecycle.anonymize`, `lifecycle.delete`, `lifecycle.hold_place`, `lifecycle.hold_release`, `account.deactivate`, `account.reactivate`.
- Rights: `select` granted to `authenticated` under policy `audit_events_admin_read` (super admin of the organization, or group admin of the event's group; 20261015:152-163). No insert, update or delete right for any application role; update and delete also refused by trigger.

### Public audited functions that can write a denied event
`lifecycle_hold_place`, `lifecycle_hold_release` (20261013; `authenticated`), the invitation functions (20261017, 20261021, 20261030, 20261033) and the grant and account-change functions (20261018, 20261033). Their argument lists were not re-documented in this focused update.

### Earlier contracts (2026-10-12, still present)
- SQL helpers `authorization_version_for`, `has_current_role_scope`, `has_super_scope`, `has_core_scope` (now also require `current_session_is_active()`, 20261015:24-47).

## Configuration contract (2026-10-12)

`APP_RUNTIME_MODE` (`synthetic` | `production`); synthetic: `APP_SYNTHETIC_FIXTURE_VERSION`; production: `APP_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Other variables: `APP_HOST`, `APP_PORT`, `SYNTHETIC_TEST_COPIES`, `APP_LOGIN_TEST_DIST_DIR`, `NODE_ENV`. Not re-scanned; the local backend work likely changed it.
