# Architecture Analysis

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`: sign-in, shell and navigation area, new section "Sign-in, session and landing (2026-11-02)" and interaction diagram 7). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. It added the sections "Session gate and actor choke point", "Privilege model", "Audit purge and housekeeping" and "Local stack configuration" and corrected the migration count. The 2026-10-27 update rewrote "Database Layer" and added "Platform audit write" and interaction diagram 6. Every other section is kept from 2026-10-12 and describes the synthetic prototype as it was then; it is stale wherever the U1 to U5 backend work changed the application (not re-scanned).

## System Overview

A single Next.js 16 App Router application (React 19, TypeScript, zod) with server components and server actions. At the 2026-10-12 scan all business state was held in process memory by four `synthetic-*` adapters behind a layered application module (`src/application`: authorization, facade pipeline, idempotency, result modelling). Since then (2026-10-27 listing) the business state lives in a Supabase PostgreSQL schema built by 40 forward-only migrations (39 at the 2026-10-27 listing; the 40th is `20261046_audit_denied_rate_limit.sql`); the application reaches it through database functions called over the data API (`src/data/gateway.ts`, `client.rpc(name, args)`), each returning the envelope `{state, reference, code}`.

## Architectural Style

Modular monolith, ports-and-adapters flavoured, with a request-scoped composition root (`composeRuntime()`). In the database (2026-10-27) the same style continues: tables are closed to application roles, and every change goes through a named `security definer` function that authorizes, changes, audits and stores the idempotent result in one transaction.

The 2026-10-12 scan found two code families (verified by import grep then):

- **Family A, wired:** `src/application`, `src/runtime`, and the adapters `src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`.
- **Family B, unwired domain services:** `src/access`, `src/coordination`, `src/directory`, `src/import-migration`, `src/notifications`, `src/parent-experience`, `src/privacy-audit`, `src/admin-experience`, and `TeacherScheduleService` in `src/teacher-tracking`.

## Component Relationships

```mermaid
flowchart TB
  Browser["Browser (Hungarian UI)"] --> Pages["app/ pages, layouts, server actions"]
  Pages --> Lib["app/*/_lib session + facade resolvers"]
  Lib --> Facades["src/application facades + FacadePipeline"]
  Facades --> Data["src/data ports and gateway (RPC)"]
  Data --> Fn["Named database functions (security definer)"]
  Fn --> Finish["platform_finish_operation"]
  Finish --> AuditW["platform_audit_write"]
  Finish --> Idem["platform_idempotency_store"]
  AuditW --> Audit[("audit_events (append-only)")]
  Idem --> IdemT[("idempotency_records")]
  Fn -->|success-only direct calls| AuditW
  House["identity_housekeeping (service key)"] --> Purge["audit_purge (max 5000 rows)"]
  Purge --> Audit
```

Text fallback: browser to pages and server actions; resolvers call `src/application` facades; facades call `src/data` ports, which call named database functions over RPC. A named function finishes through `platform_finish_operation`, which calls `platform_audit_write` for a success or a denial and always stores the idempotent result. A few functions call `platform_audit_write` directly, always with outcome `success`. The service-key housekeeping purges audit events older than 365 days. The diagram's application half is from the 2026-10-12 scan plus a 2026-10-27 skim of `src/data/gateway.ts`; the database half was analyzed on 2026-10-27.

## Sign-in, session and landing (2026-11-02)

The synthetic mode, the `waldorf_local_session` cookie and the profile picker described in the 2026-10-12 sections below no longer exist in this area; the application is production-only and signs people in with the Supabase sign-in service.

- **Composition**: `composeRuntime()` (`src/runtime/composition.ts`) validates the settings and always imports `production/composition.ts`; `RuntimeComposition.authenticationBoundary` is `"supabase-session"` and `services.forRequest(accessToken)` builds the parent, admin and teacher facades on a database client acting as that person (`src/runtime/production/services.ts`).
- **Session**: cookies `wb_access` and `wb_refresh` (httpOnly, sameSite lax, 30 days; `src/identity/cookies.ts`). `proxy.ts` renews or clears them per request and sets the CSP nonce; it does no role routing. Pages read the session through `currentSession()` (`app/_identity/current-session.ts`, never refreshes, expired reads as signed out) and `productionRequest()` (memoised with `cache`, returns `ready | signed-out | unavailable`).
- **Role resolution**: `resolveParentAccess`, `resolveAdminAccess`, `resolveTeacherAccess` (`src/runtime/production/access.ts`) read the account's grants as the person and return `success` with a `ShellProfile {label, scopeSummary, homePath, navigation}`, or `denied` (carrying `homePath` of the strongest role held, order super admin, group admin, teacher, parent), `signed-out` or `unavailable`. `HOME`: parent `/szulo/ertesitesek`, teacher `/teacher/schedule`, group admin and super admin `/admin`.
- **Home resolution**: `resolveProductionHome()` (`app/_identity/production-home.ts`) returns `ready {path} | signed-out | no-role | unavailable`. Only `app/page.tsx` (`/`) uses it: `ready` redirects to the path; the other states render panels (sign-in link, no-role, unavailable). It uses `resolveAdminAccess` as the generic resolver.
- **Shell**: the role layouts `app/admin/layout.tsx`, `app/szulo/layout.tsx`, `app/teacher/layout.tsx` resolve their access and wrap pages in `AppShell` (`src/runtime/AppShell.tsx`): skip link, header (brand link to `profile.homePath`, role label, scope summary, `headerAction` = `SignOutButton`), `AppNav` only when `profile.navigation.length > 0`, then the main content. Admin and teacher layouts `redirect("/")` when signed out; the parent layout renders an access panel instead. The menu lists live in `src/runtime/navigation.ts`; `TEACHER_NAVIGATION` is empty by design.
- **Sign-in screen (`/bejelentkezes`)**: not inside any role layout, so it has no shell. `SignInPage` shows the form for a signed-out visitor and, for a signed-in one, only `signed-in-panel` (heading, message, `SignOutButton`).
- **Gap found (2026-11-02, cause of the reported defect)**: `signInAction` (`app/bejelentkezes/actions.ts:44-45`) writes the cookies and `redirect("/bejelentkezes")`, so the freshly signed-in person lands on the shell-less panel; nothing calls `resolveProductionHome()` for them. Password reset (`app/jelszo-visszaallitas/uj/actions.ts:38`) and invitation acceptance (`app/meghivas/[token]/actions.ts:41,43`) use the same destination. Sign-out also redirects to `/bejelentkezes`, which is correct (signed out).

## Runtime Composition (2026-10-12, superseded by the section above)

- `composeRuntime(env)` (`src/runtime/composition.ts`) is async, called on essentially every request, and dynamic-imports one of two compositions. Result type is a discriminated union `mode: "synthetic" | "production"`.
- Production composition was then a stub (`authenticationBoundary: "supabase-unlinked"`).
- Facade lifetime differs per area: parent facade cached on `globalThis`; admin built per call; teacher built per request with a `scenario` argument.

## Session and Access Model (2026-10-12)

- Cookie `waldorf_local_session`: HMAC-SHA256 signed payload `{profileId, authorizationVersion, issuedAt, nonce}`, 8 h, secret was a source constant.
- `AuthorizationContract.authorize` rejects an inconsistent mode pair (`INVALID_SESSION_MODE`), returns `invalidated` for stale versions, then does matrix lookup and scope containment.
- Gating is in layouts and actions, not in `proxy.ts`.

Database side (2026-10-27): `current_session_is_active()` (20261015:9-22) accepts a request only for a live `auth.sessions` row of an active account (30-day inactivity limit). `platform_actor_account()` (redefined in 20261015:51-67) raises `28000` without a signed-in user and `42501` without an active session, and returns the nil system account `00000000-0000-0000-0000-000000000000` when the caller is `postgres`, `service_role` or `supabase_admin` (`platform_caller_is_system()`, 20261012:14-16).

## Data Flow

Request path (2026-10-12): page or action calls `resolve<X>Session()` then `resolve<X>Facade()`; the facade runs `FacadePipeline.invoke`: authorize, optional validate, idempotency coordinator, domain invoke (the port), project. Results are `ApplicationResult`/`DomainOutcome<T>` mapped to UI state.

Database path (2026-10-27): a named function computes a SHA-256 request fingerprint, calls `platform_idempotency_check` (advisory transaction lock per account, operation and key; returns `new`, `replay` or `conflict`), validates, authorizes with `platform_actor_role(org)` or the identity helpers, changes rows, then returns `platform_finish_operation(...)`. Validation, conflict and terminal states store a result but write no audit event.

## Database Layer (2026-10-27)

- 40 files in `supabase/migrations/` (2026-11-02 listing), applied in file-name order by the project's runner (`npm run db:migrate`, `scripts/db/runner.ts`) into `public` and into the test schemas `worker_1`..`worker_4`; the Supabase CLI migration feature is off (`supabase/config.toml`).
- Forward-only is enforced: the runner stores a checksum per applied file and refuses a changed file ("migrations are forward-only. Reset the schema or add a new file.", `runner.ts:146-151`). Follow-up files say so in their header ("Forward-only: the merged file X is not edited", 20261044:2, 20261045:1-2).
- Schema-neutral is enforced: no `public.`/`worker_N.` qualified names, no fixed `search_path`, no `create schema`; every function uses `set search_path from current` (`runner.ts:41-55`; `migrations.test.ts` checks every function's pinned path).
- Privileges: no table rights for `anon`, `authenticated` or `service_role` on platform tables; functions lose the default PUBLIC execute right and get explicit grants next to their definition (20261019:21-67). A redefinition with `create or replace` keeps the old ACL, but the convention is to restate the revoke/grant lines.
- Units: U1 platform (20261012-20261013), U2 identity (20261014-20261023, 20261033), U3 directory/coordination/kernel/schedule/lifecycle (20261024-20261035), U4 notifications and import (20261036-20261043), U5 audit purge (20261044), follow-up B1 purge isolation (20261045), follow-up B3 denied-event limit (20261046, header read only).

## Platform audit write (2026-10-27)

- Table `audit_events` (20261012:60-82): `id uuid` default `gen_random_uuid()`, `actor_account_id uuid not null`, `actor_role` (check list), `action` (check list, widened in 20261014:88-95 by drop/add of `audit_events_action_check`), `target_type`, `target_id uuid`, `organization_id uuid`, `group_id uuid` nullable, `outcome` in (`success`, `denied`), `details` code-shaped, `occurred_at timestamptz default now()`. Indexes: `audit_events_actor (actor_account_id, occurred_at desc)`, `audit_events_target (target_type, target_id, occurred_at desc)`, `audit_events_time (occurred_at desc)`. RLS on; read policy `audit_events_admin_read` (20261015:152-155); no write policy.
- Append-only trigger `audit_events_refuse_change` (20261012:84-90, redefined 20261044:10-19): refuses every update, and every delete except an aged row inside `audit_purge()`.
- `platform_audit_write(p_action, p_target_type, p_target_id, p_organization_id, p_group_id, p_outcome, p_details) returns uuid` (20261012:94-108), `security definer`, pinned search path, executable by no application role (20261012:109). It inserts one row with `platform_actor_account()` and `platform_actor_role(p_organization_id)` and returns the new id. It is defined in 20261012 and, per the header of 20261046 (not analyzed), redefined there with the same signature and return type to add the denied-event limit; it returns null and writes nothing for a denied event over the limit. Everything below about its body describes the 20261012 definition.
- Denied events reach it only through `platform_finish_operation` (20261013:82-95), called directly by the function or through `identity_deny` (20261015:120-126). The seven direct callers pass `success`.
- Key for a per-account limit: `actor_account_id`, which is the session's `auth.uid()` or the nil system account. A row's time is the transaction start (`now()`).
- Verified again 2026-11-02: `platform_actor_role` calls `platform_actor_account` first, so a caller without an active session raises `42501` and never reaches the insert; the actor key for any limit is therefore a live session's `auth.uid()` or the nil system account.
- `platform_finish_operation` ignores the audit write's return value (`perform`) and builds its result from its own arguments, so a write that is skipped changes neither the returned envelope nor the stored idempotency record.

## Session gate and actor choke point (2026-11-02, audit re-verified)

- `current_session_is_active()` (20261015:9-22, `security definer`, executable by `authenticated`) is true only when the token's `session_id` matches an `auth.sessions` row of the caller's uid, the `accounts` row is `active`, `not_after` is unset or in the future, and the session was refreshed (or created) within 30 days. The same 30 days is configured as `[auth.sessions] inactivity_timeout = "720h"` in `supabase/config.toml`; the database checks it as well so an idle session reads nothing before the sign-in service refuses a refresh.
- The policy helpers `authorization_version_for`, `has_current_role_scope`, `has_super_scope`, `has_core_scope` and the new `identity_*` helpers (`identity_actor_organization`, `identity_can_manage_scope`, `identity_scope_group`, `identity_account_visible`) all call it first (20261015:25-118). Policies on `app_role_grants`, `app_authorization_versions`, `accounts`, `invitations` and `audit_events` require it.
- `platform_actor_account()` (final form 20261015:51-67) is the single choke point of every audited, idempotent operation: system caller gives the nil account, no `auth.uid()` raises `28000`, an inactive session raises `42501` (mapped to `denied` by the application).
- Session cookies of the web layer and this database check are independent: the web redirect after sign-in does not depend on the database session gate, and a `denied` role resolution on the web side is not an audit event.

## Privilege model (2026-11-02, audit re-verified)

- Platform tables (`audit_events`, `idempotency_records`, `lifecycle_holds`) have row-level security on and every right revoked from `public, anon, authenticated, service_role` (20261012:82, 20261013:21, 20261012:138). The only grant is `select on audit_events to authenticated` under the read policy (20261015:163).
- Internal functions (`platform_audit_write`, `platform_actor_account`, `platform_actor_role`, `platform_caller_is_system`, `platform_idempotency_check` / `_store`, `platform_finish_operation`, `platform_result`, `identity_*` helpers except the two granted to `authenticated`) have `revoke all` from the four roles next to their definition; the hold functions are executable by `authenticated` only (20261013:209-216 plus the service-role revoke in 20261019:36-37).
- 20261019 is a one-time sweep: it drops the superseded `app_audit_events` table only if no function, policy of another table, view or foreign key mentions it (7-19); removes every table, sequence and default right of `service_role` (23-30); revokes execute from `public, anon, service_role` on every schema-owned, non-extension function that exists at that moment (42-53); removes `authenticated` execute from trigger functions and `platform_system_account` (54-62); and grants `service_role` exactly ten functions (63-67): `sign_in_lockout_check`, `sign_in_attempt_record`, `sign_in_attempt_clear`, `invitation_lookup`, `invitation_reserve`, `invitation_release`, `invitation_accept`, `account_recovery_check`, `sessions_remove`, `identity_housekeeping`.
- Consequence: the sweep does not cover functions created by later files. PostgreSQL gives PUBLIC execute on new functions, and the default-privilege line revokes only from `service_role` (30). Later files (20261044, 20261045 and the others) therefore restate `revoke all ... from public, anon, authenticated, service_role` and an explicit grant for every function they define. `migrations.test.ts` checks this for the platform functions only.

## Audit purge and housekeeping (2026-11-02, audit re-verified)

- 20261044 changes `audit_events_refuse_change`: every update is refused; a delete is allowed only when `current_setting('app.audit_purge', true)` is `on` and the row is older than 365 days (lines 10-19). The setting is set only inside `audit_purge()` with `set_config(..., true)` (transaction-local) and set to `off` before it returns; no application role holds a delete right, so setting it elsewhere changes nothing.
- `audit_purge()` is `security definer`, checks `platform_caller_is_system()` (else `42501`), returns the number of deleted rows, writes no event and returns no personal data. 20261045 caps it at 5000 rows per call (ids chosen oldest first by `occurred_at, id`, deleted by id) so a long backlog is worked off over several housekeeping runs.
- `identity_housekeeping()` (system caller only, otherwise a `denied` envelope with code `admin_access_required`) releases stale invitation reservations, prunes `sign_in_attempts` (older than 30 minutes and more than 20 per e-mail hash), deletes orphaned invitation users from `auth.users`, deletes old accepted, revoked or replaced invitations (90 days), counts expired invitations, expires imports, and runs the purge. In 20261045 the purge runs in an inner `begin ... exception when others` block: a failing purge rolls back only itself, sets `audit_purge_failed` and the rest commits. The failure carries no error text.
- Both functions are executable by `service_role` only (restated at the end of 20261044 and 20261045).

## Local stack configuration (2026-11-02, audit re-verified)

`supabase/config.toml` configures only what the project uses: Postgres 17 (port 54322, shadow 54320, pooler off), the data API on 54321 exposing `public` and `worker_1` to `worker_4`, the sign-in service (Auth) with the mail catcher on 54324/54325. Realtime, studio, storage, edge runtime and analytics are off; the CLI's own migration and seed features are off because the project runner applies the files. Auth settings: open sign-up refused (`enable_signup = false`), anonymous sign-ins off, minimum password length 8 with letters and digits, 1-hour access tokens with refresh-token rotation (10-second reuse interval), inactivity timeout 720 hours, rate limits 30, e-mail changes need confirmation on both addresses, no sign-up confirmations, Hungarian recovery e-mail template from `supabase/templates/recovery.html`. A password-verification hook (`pg-functions://postgres/public/password_verification_hook`, wired for the default schema only) applies the five-wrong-passwords lockout to direct sign-in-service calls too. `[auth.email] enable_signup = true` is deliberate: in this CLI version it switches the whole e-mail provider, not only open sign-up.

## What a Real-Backend Migration Will Meet (2026-10-12, historical)

Kept for context; most items were addressed by intent `261012-real-backend-local` and the U1 to U5 work and were not re-verified.

- Unwired `src` modules duplicated business rules with the in-memory Family A ports; Family B ports were synchronous.
- Id mismatch: SQL `uuid` versus TypeScript slug ids (`family-boroka`, `org-napsugar`).
- `20260806_access_rls.sql` used the reserved word `grant` as an alias; `migrations.test.ts` now checks that the alias is gone (FR1.2).
- SQL covered only grants, versions, evidence and four thin tables (since extended by 37 files).
- Stub authentication and fake features (literal tokens, fixed import preview, no reminder runner).
- Synthetic-mode footprint of about 50 files; global mutable state on `globalThis`.
- Config accepted only `synthetic` or `production` with an `https://` Supabase URL.
- Environment then: no container runtime or Supabase CLI; Homebrew PostgreSQL 18 needed `LC_ALL=C`; Node 26 default versus 24 required. The local Supabase stack (`npm run db:start`) is now the database used by the tests.

## Key Design Decisions

- Four-role versioned authorization with a single matrix (`four-role-v1`) and revocation by version bump.
- Result-state modelling: 12 states with presentation codes; expected failures never thrown.
- Facade pipeline with idempotency and projection guard around every operation.
- Database (2026-10-27): one audited-operation pattern for all units (idempotency check, authorization, change, `platform_finish_operation`); the actor is never a parameter (BR3.9); the audit write is in the change's transaction (BR3.3); forward-only, schema-neutral migrations so parallel test workers each own a schema.
- ADR-style rule: no executable deployment workflows until a deployable app and target exist.

## Improvement Opportunities (observations)

- 2026-11-02: the landing after sign-in is decided by the sign-in action (self-redirect) and by the sign-in page (dead-end panel) rather than by the one resolver that already knows the role home (`resolveProductionHome`); the home resolution has a single caller (`app/page.tsx`).
- 2026-10-12: Family A/B duplication; sync ports versus async facades; hardcoded session secret (not re-verified).
- 2026-11-02 (audit re-verified): the limit that 2026-10-27 observed missing is now merged as 20261046 (header read, not analyzed); the files analyzed here, 20261012 to 20261045, predate it. Other observations from this re-read: a failing purge is visible only through the `audit_purge_failed` flag; the one-time privilege sweep in 20261019 does not cover later functions, so each new file must restate its own revoke.
- 2026-10-27 (since addressed by 20261046): denied events have no volume limit per account, so one account can grow `audit_events` without bound until the 365-day purge (intent `denied-audit-ratelimit`); there is no outcome-aware index for counting an account's recent denials; count-then-insert logic needs a per-account advisory lock if the cap must hold under concurrent calls.

## Interaction Diagrams

Diagrams 1 to 5 are from 2026-10-12 and show the in-memory prototype; diagram 6 is from 2026-10-27; diagram 7 is from 2026-11-02.

### 1. Parent signs up for a task (2026-10-12)

```mermaid
sequenceDiagram
  actor P as Parent
  participant UI as app/szulo/feladatok (page + actions.ts)
  participant S as _lib/session.ts
  participant F as ParentApplicationFacade
  participant PL as FacadePipeline
  participant AZ as AuthorizationContract
  participant PP as SyntheticParentPort
  P->>UI: submit sign-up form (dutyId, version)
  UI->>S: resolveParentSession()
  S-->>UI: session
  UI->>F: signUp(session, dutyId, version, idempotencyKey)
  F->>PL: invoke(authorize, validate, idempotency)
  PL->>AZ: authorize(session, AUTH-PARENT-DUTIES)
  AZ-->>PL: allowed (or invalidated/denied)
  PL->>PP: signUp(...)
  PP-->>PL: DomainOutcome
  PL-->>UI: ApplicationResult
  UI-->>P: Hungarian status message
```

Text: the action resolves the session, the pipeline authorizes against the parent matrix row, validates, checks the idempotency key and calls the port, which returned a result state from in-memory data.

### 2. Swap request and approval (2026-10-12)

```mermaid
sequenceDiagram
  actor P as Parent
  actor A as Group admin
  participant PP as SyntheticParentPort
  participant AP as SyntheticAdminPort
  P->>PP: requestSwap
  PP-->>P: duty state swap-pending
  A->>AP: approvals.list / approvals.decide
  AP-->>A: version bumped, state updated
  Note over PP,AP: The two in-memory ports shared no state
```

Text: parent and admin ports were separate in-memory stores at the time.

### 3. Admin approval (2026-10-12)

```mermaid
sequenceDiagram
  actor A as Admin
  participant S as admin/_lib/session.ts
  participant F as admin/_lib/facade.ts
  participant CP as CompositeAdminPort
  A->>S: resolveAdminSession()
  A->>F: approvals.decide
  F->>CP: execute({actorId, operation, scope, payload})
  CP-->>A: ApplicationResult mapped to UI
```

Text: `CompositeAdminPort` routed 13 operations to `AdvancedWorkflowStore` and the rest to `SyntheticAdminPort`, after facade authorization.

### 4. Invitation (2026-10-12)

```mermaid
sequenceDiagram
  actor P as Invited parent
  participant IA as app/meghivas/[token]/actions.ts
  participant SG as SessionApplicationFacade
  P->>IA: accept
  IA->>SG: acceptInvitation(token, {})
  SG-->>IA: destination /szulo/feladatok
  IA-->>P: signed cookie, redirect
```

Text: acceptance then created no identity or family binding (since replaced by `invitation_*` database functions).

### 5. Reset (test only, 2026-10-12)

`POST /api/synthetic/reset` reset the in-memory stores; the database tests now use `resetWorkerData` (truncate every table of a test schema) instead.

### 6. Denied call and its audit event (2026-10-27)

```mermaid
sequenceDiagram
  actor U as Signed-in account
  participant G as src/data gateway (RPC)
  participant N as Named function e.g. lifecycle_hold_place
  participant IC as platform_idempotency_check
  participant FO as platform_finish_operation
  participant AW as platform_audit_write
  participant AE as audit_events
  participant IR as idempotency_records
  U->>G: call operation with idempotency key
  G->>N: rpc(name, args)
  N->>IC: (operation, key, fingerprint)
  IC-->>N: new
  N->>N: platform_actor_role(org) is not allowed
  N->>FO: state denied, code authorization_denied
  FO->>AW: perform (action, target, org, group, denied, details)
  AW->>AE: insert actor_account_id = platform_actor_account()
  FO->>IR: platform_idempotency_store(state denied)
  FO-->>N: {state: denied, reference: null, code: authorization_denied}
  N-->>G: envelope
  G-->>U: denied, code authorization_denied
```

Text: the named function checks idempotency, finds the caller not authorized and returns through `platform_finish_operation`. That function writes the denied audit event through `platform_audit_write` (actor and role taken from the session), stores the `denied` result for 24-hour replay and returns the envelope. The gateway maps `denied` to `authorization_denied`. A replay with the same key returns the stored `denied` result without a new audit event. `identity_deny` is a one-line wrapper that makes the same `platform_finish_operation` call.

### 7. Sign-in today and the role home reached from `/` (2026-11-02)

```mermaid
sequenceDiagram
  actor P as Person
  participant SF as SignInForm (client)
  participant SA as signInAction
  participant SI as signIn (src/identity)
  participant SP as SignInPage /bejelentkezes
  participant HP as HomePage /
  participant PH as resolveProductionHome
  participant RL as Role layout + AppShell
  P->>SF: submit e-mail and password
  SF->>SA: server action
  SA->>SI: signIn(credentials)
  SI-->>SA: success with token pair
  SA->>SA: writeTokenPair (wb_access, wb_refresh)
  SA-->>P: redirect /bejelentkezes
  P->>SP: GET /bejelentkezes
  SP->>SP: currentSession is signed-in
  SP-->>P: signed-in-panel only (no shell, no menu)
  Note over P,HP: Only when the person opens "/"
  P->>HP: GET /
  HP->>PH: resolve home
  PH-->>HP: ready, path of strongest role
  HP-->>P: redirect to path
  P->>RL: GET /admin, /szulo/ertesitesek or /teacher/schedule
  RL-->>P: AppShell with header, sign-out and the role menu
```

Text: after a successful sign-in the action stores the cookies and redirects to the sign-in page itself, which shows only the signed-in panel. The role home and menu appear only after a separate request to `/`, where `resolveProductionHome` finds the strongest role and redirects to its home inside the role layout's `AppShell`.
