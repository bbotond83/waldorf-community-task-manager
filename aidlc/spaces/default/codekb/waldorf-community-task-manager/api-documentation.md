# API Documentation

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`; section "Sign-in and landing contracts (2026-11-02)"). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. It extended the table of platform functions below. Focused update 2026-11-02 (HEAD `1070fd6`, intent `no-access-signout`): the sign-in redirect row corrected and the section "Denied pages and sign-out contracts (2026-11-02, after 1070fd6)" added. Focused update 2026-11-04 (HEAD `251c4b3`, intent `stitch-design-update`): new section "Screen, form and header contracts a restyle must keep (2026-11-04)"; the sign-in `GET` row and the denied-page rows corrected in place. The 2026-10-27 update rewrote "Database-facing contracts". The HTTP, server-action and application-port sections are kept from 2026-10-12 and were not re-scanned (the synthetic routes and ports they describe may since have changed).

## Screen, form and header contracts a restyle must keep (2026-11-04, after 251c4b3)

Read from `app/`, `proxy.ts` and `tests/browser/`; nothing executed. These are the surfaces a visual change must not alter. Class names are listed in `code-structure.md`; this section lists behaviour and test hooks.

### Routes and page names

| Path | Hungarian `h1` | Notes |
|---|---|---|
| `/` | "Biztonságos bejelentkezés" (only for signed-out, no-role, unavailable; a ready role is redirected) | `main#fo-tartalom.centered-panel`, `data-testid` `production-auth-boundary`, `production-sign-in-link`, `production-no-role`, `production-unavailable` |
| `/bejelentkezes` | `COPY.signIn.heading` | signed-in visitor is redirected to `/` (2026-11-04) |
| `/szulo/ertesitesek` | "Értesítések" | parent home |
| `/szulo/feladatok` | "Családi feladatok" | query `allapot` filters by state |
| `/szulo/feladatok/[id]` | the duty title (eyebrow "Feladat részletei") | query `allapot`, `ertesites` |
| `/szulo/feladatok/[id]/csere` | "Cserekérelem" | |
| `/szulo/feladatok/[id]/lemondas` | "Lemondási kérelem" | |
| `/szulo/cserek` | "Cserék és kérelmek" | |
| `/teacher/schedule`, `/teacher/schedule/[id]` | "Beosztás", the entry title | |
| `/admin`, `/admin/jovahagyasok`, `/admin/jovahagyasok/[id]` | "Áttekintés", "Jóváhagyások", "Kérelem elbírálása" | other admin pages: "Nyilvántartások", "Feladatok és események", "Archívum", "Importálás", "Emlékeztetők", "Adatvédelem", "Beállítások" |
| denied states | "Nincs jogosultság" | `id="hozzaferes-megtagadva"` is a focus target |

### Forms (field names and ids are part of the server-action contract)

| Form | Fields | Submit | Result hooks |
|---|---|---|---|
| Sign-in (`sign-in-form`) | `email` (`#signin-email`), `password` (`#signin-password`) | `sign-in-submit` | error `p#signin-form-error[role=alert]` (`sign-in-error`), field errors `sign-in-email-error`, `sign-in-password-error` |
| Duty filter (`duty-filter-form`, GET `/szulo/feladatok`) | select `allapot` (`#allapot`, `duty-filter-select`) | `duty-filter-submit-button` ("Szűrés") | list `duty-list`, `duty-card-<id>`, `duty-open-<id>`; empty `duties-empty`; no match `duties-filter-empty` |
| Sign-up (`signup-form`) | hidden `id`, `expectedVersion`, `idempotencyKey` | `signup-form-submit-button` ("Jelentkezem") | `signup-form-state-success`, `-validation`, `-denied`, `-conflict`, `-invalidated`, `-terminal` |
| Swap request (`swap-request-form`) | radio `counterpart` (`swap-candidate-<assignmentId>`), `reason` (`#reason`, `swap-reason-input`, max 500, required), hidden `id`, `assignmentId`, `expectedVersion`, `idempotencyKey`, `partnerList` | `swap-request-form-submit-button` | state hooks as above; pending panel `swap-pending-panel` |
| Cancellation (`cancellation-request-form`) | `reason` (`#reason`, `cancellation-reason-input`), hidden ids and key | `cancellation-request-form-submit-button` ("Lemondási kérelem elküldése") | `cancellation-request-form-state-success`; `cancellation-pending-panel`, `pending-cancellation-notice` |
| Contribution note (`contribution-form`) | `note` (`#note`, `contribution-note-input`, max 300) | `contribution-form-submit-button` ("Saját megjegyzés mentése") | `contribution-form-state-success` |
| Notification read | checkbox `id` (`notification-read-checkbox-<id>`), hidden key `notice:<id>:read` | submits on tick; `notification-read-save-<id>` inside `<noscript>` | `notification-state-<id>-success`; accessible name starts "Olvasottnak jelölöm " |
| Admin approval decision (`admin-approval-decision-form`) | radio `decision` (`approved`, `rejected`), hidden `id`, `expectedVersion`, `idempotencyKey` | `admin-approval-decision-form-submit-button` ("Döntés rögzítése") | `…-state-<state>` in `#hibajelzes` |
| Sign-out (`sign-out-form`) | none | `sign-out-button` | redirect `/bejelentkezes` |

Result state classes follow `parent-action-state-<state>` and `admin-action-state-<state>` with `state` one of `success`, `validation`, `denied`, `conflict`, `invalidated`, `terminal`; success uses `role=status`, `aria-live=polite`, the rest `role=alert`, `aria-live=assertive`, and focus moves to the panel (`tabIndex=-1`).

### Server actions and idempotency
`app/szulo/actions.ts`: `signUpAction`, `requestSwapAction`, `respondToSwapAction`, `withdrawRequestAction`, `requestCancellationAction`, `markNotificationReadAction`, `updateContributionAction`. `app/admin/actions.ts`: `saveRecordAction`, `archiveRecordAction`, `restoreRecordAction`, `saveTaskAction`, `assignTaskAction`, `decideApprovalAction`, `saveEventNotesAction`. `app/admin/advanced-actions.ts`: nine import, reminder, grant, lifecycle and settings actions. `signInAction`, `signOutAction`. Forms with `freshIdempotencyKey` (swap, cancellation, contribution note) and `AdminMutationForm longForm` send from the submit handler with a new key per attempt and keep typed fields after a refusal; plain forms use the React form action. A restyle must not move these to a different submit mechanism.

### HTTP response headers (`proxy.ts`, `next.config.ts`)
`Content-Security-Policy` is set on every response that passes the proxy matcher (all paths except `api`, `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt` and prefetch requests): `default-src 'self'`, `script-src 'self' 'nonce-<per request>' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`, `font-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. The nonce is also passed to the page as the `x-nonce` request header. `next.config.ts` adds `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`. Fonts must therefore come from the app's own origin; an external font host or stylesheet would be refused.

### Accessibility contract exercised by the browser specs
Skip link `app-shell-skip-link` focuses `app-shell-main` (`#fo-tartalom`); the `h1` takes focus on load without a visible outline; `StatusBadge` icons are `aria-hidden` so link names stay "title – state"; every menu link and touch target is at least 44 px; the page has no horizontal scroll at 320 px or at zoom 2; axe (serious and critical) finds nothing on the role homes, list, detail, request and denied pages; two specs apply WCAG 2.2 AA tags.

## Sign-in and landing contracts (2026-11-02)

| Surface | Contract |
|---|---|
| `signInAction(previous: FormState, formData)` (`app/bejelentkezes/actions.ts`) | Reads `email`, `password`. Configuration problem: `{status:"error", message: COPY.signIn.temporary}`. Failure: `signInFormState(result, email)` (generic invalid, locked, temporary). Success: writes `wb_access` and `wb_refresh`, then `redirect("/")` (since `1070fd6`; `redirect("/bejelentkezes")` at `3456409`). Never returns credentials. |
| `signOutAction()` (`app/_identity/actions.ts`) | Ends this browser's session (scope local), emits the `sign_out` event, clears both cookies, `redirect("/bejelentkezes")`; clears the cookies even when the service is unreachable. |
| `GET /bejelentkezes` | Dynamic. Signed out: form plus forgot-password link. Signed in: `signed-in-panel` (heading "Be van jelentkezve", status message, sign-out) at `3456409`; at `251c4b3` a signed-in visitor is redirected to `/` (`app/bejelentkezes/page.tsx:13`). |
| `GET /` | Dynamic. Runtime misconfiguration: configuration-error panel. `resolveProductionHome()` `ready`: redirect to the role home. Else panel for `signed-out` (link to `/bejelentkezes`), `no-role` (`production-no-role` paragraph plus sign-out), `unavailable`. |
| `resolveProductionHome(): ProductionHome` | `{state:"ready", path} | {state:"signed-out"} | {state:"no-role"} | {state:"unavailable"}`; path is the home of the strongest role. |
| Role homes | super admin and group admin `/admin`; parent `/szulo/ertesitesek`; teacher `/teacher/schedule`. |
| Other redirects to `/bejelentkezes` | `app/jelszo-visszaallitas/uj/actions.ts:38` (after new password), `app/meghivas/[token]/actions.ts:41,43` (after invitation acceptance, with or without tokens) as read at `3456409`; whether `1070fd6` changed them was not re-read. |
| Redirects to `/` | Admin and teacher layouts and the teacher schedule pages when signed out. |

`proxy.ts` matcher: every path except `api`, `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt` and prefetch requests. The 2026-10-12 routes `/api/synthetic/session` and `/api/synthetic/reset` and the profile-picker flow are not part of this area at this commit.

## Denied pages and sign-out contracts (2026-11-02, after 1070fd6)

| Surface | Contract |
|---|---|
| `resolveParentAccess` / `resolveAdminAccess` / `resolveTeacherAccess` (`src/runtime/production/access.ts`) | Return `success {profile: ShellProfile}`, `denied {homePath}`, `signed-out` or `unavailable`. `denied` for a parent: role held but no linked `parents` record, or grant scope not matching the record's family. `homePath` is the home of the strongest role held (`deniedFor`), so it can equal the page being rendered. |
| `ParentAccessState({kind})` (`app/szulo/_components/ParentAccessState.tsx`) | Kinds `denied`, `configuration-error`, `signed-out`. Denied/configuration-error markup: `section#hozzaferes-megtagadva[tabIndex=-1][data-testid=parent-access-denied]`, `<h1>Nincs jogosultság</h1>`, paragraph (denied: "A kért tartalom nem érhető el ezzel a profillal."; configuration-error: "A helyi futtatási beállítás nem érhető el."), `BackToHomeLink` (`parent-access-home-link`, "Vissza a biztonságos kezdőoldalra"). (2026-11-04: the link is omitted when `homePath` starts with `/szulo`, and `AccessStateExit` adds `access-guidance` for `denied` plus `SignOutButton`.) |
| `AdminAccessState`, `TeacherAccessState` | Same heading; testids `admin-denied` / `admin-access-state-home-link` and `teacher-denied` / `teacher-access-home-link` (teacher link to `/`). (2026-11-04: both render `AccessStateExit`.) |
| `GET /hozzaferes-megtagadva` | Static page, `access-denied-state`, link `access-denied-home-link`; no code redirects to it. |
| `SignOutButton` | `"use client"`, no props. Renders `<form action={signOutAction} data-testid="sign-out-form">`; submit button class `secondary-button`, `data-testid="sign-out-button"`; texts from `COPY.signOut` ("Kijelentkezés", pending "Kijelentkezés folyamatban…"). |
| Request safety | httpOnly cookies, `proxy.ts` CSP with `form-action 'self'`, Next.js server-action same-origin check; no extra token needed for a sign-out on a denied page. |
| Focus targets | `focusTarget: "#hozzaferes-megtagadva"` in `src/application/results.ts` and `facade-pipeline.ts` (handoff; not opened). Keep the id and the single `<h1>`. |

## HTTP route handlers (2026-10-12)

| Route | Method | Behaviour |
|---|---|---|
| `/api/readiness` | GET | Returns `{status, mode, marker: "waldorf-local-ready"}`; used by Playwright `webServer`, `scripts/start-smoke.mjs` (2026-11-04: body is `{status: "ready", marker: "waldorf-local-ready"}`, or 503 `{status: "not-ready", code}`; no `mode` field) |
| `/api/synthetic/session` | POST form `profileId` | Same-origin check, sets signed cookie `waldorf_local_session`, 303 redirect; `profileId=""` clears the cookie |
| `/api/synthetic/reset` | POST | 404 unless synthetic mode; resets the in-memory stores |
| `/munkatars/beosztas`, `/munkatars/beosztas/[id]` | GET | Legacy redirects to `/teacher/schedule` (`app/munkatars/beosztas/route.ts` still exists at 2026-11-02; 2026-11-04: answers 307 with a `Location` built by `compatibilityLocation`) |

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
| `audit_purge() returns integer` | 20261044, capped in 20261045:15-32 | System caller only (`service_role` execute grant; `42501` for any other caller); deletes at most 5000 events older than 365 days, oldest first; returns the count; writes no event. |
| `identity_housekeeping() returns jsonb` | 20261044:40-74, redefined 20261045:37-76 | System caller only (otherwise `denied` / `admin_access_required`). Returns `success` / `done` plus `attempts_removed`, `users_removed`, `invitations_removed`, `invitations_expired`, `reservations_released`, `import_runs_expired`, `audit_events_purged` and (since 20261045) `audit_purge_failed`. |
| `current_session_is_active() returns boolean` | 20261015:9-22 | True for a live session of an active account within 30 days of inactivity; executable by `authenticated`. |
| `platform_idempotency_store(p_operation, p_key, p_fingerprint, p_state, p_reference) returns void` | 20261013:53-80 | Stores for 24 hours; replaces an expired row; `22023` for a state outside the five storable ones; `23505` when an unexpired record exists. |
| `platform_cleanup_expired() returns integer` | 20261013:98-105 | Deletes expired idempotency rows; not executable by any application role since 20261019:38 (run through the owner connection). |
| `platform_audit_write` after 20261046 | 20261046 (header read, not analyzed) | Same signature; returns null and writes nothing for a denied event over the limit of 20 per account per 60 minutes. |

### Audit table contract (`audit_events`)
- Columns, checks and indexes: see `architecture.md` "Platform audit write". Outcomes: `success`, `denied`. Actions (after 20261014): `role.grant`, `role.revoke`, `role.first_super_admin`, `approval.approve`, `approval.reject`, `import.commit`, `lifecycle.anonymize`, `lifecycle.delete`, `lifecycle.hold_place`, `lifecycle.hold_release`, `account.deactivate`, `account.reactivate`.
- Rights: `select` granted to `authenticated` under policy `audit_events_admin_read` (super admin of the organization, or group admin of the event's group; 20261015:152-163). No insert, update or delete right for any application role; update and delete also refused by trigger.

### Execute rights (2026-11-02, audit re-verified)
- `authenticated`: `lifecycle_hold_place`, `lifecycle_hold_release`, `current_session_is_active`, `identity_account_visible`, `identity_can_manage_scope` among the audit-area functions; the application functions of later units carry their own grants.
- `service_role` (the sign-in service's key): exactly `sign_in_lockout_check`, `sign_in_attempt_record`, `sign_in_attempt_clear`, `invitation_lookup`, `invitation_reserve`, `invitation_release`, `invitation_accept`, `account_recovery_check`, `sessions_remove`, `identity_housekeeping` (20261019:63-67), plus `audit_purge` (20261044) and whatever later files grant; it has no table or sequence rights.
- `anon`: none. PUBLIC: removed on existing functions by the 20261019 sweep; later functions must restate the revoke.

### Public audited functions that can write a denied event
`lifecycle_hold_place`, `lifecycle_hold_release` (20261013; `authenticated`), the invitation functions (20261017, 20261021, 20261030, 20261033) and the grant and account-change functions (20261018, 20261033). Their argument lists were not re-documented in this focused update.

### Earlier contracts (2026-10-12, still present)
- SQL helpers `authorization_version_for`, `has_current_role_scope`, `has_super_scope`, `has_core_scope` (now also require `current_session_is_active()`, 20261015:24-47).

## Configuration contract (2026-10-12)

`APP_RUNTIME_MODE` (`synthetic` | `production`); synthetic: `APP_SYNTHETIC_FIXTURE_VERSION`; production: `APP_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Other variables: `APP_HOST`, `APP_PORT`, `SYNTHETIC_TEST_COPIES`, `APP_LOGIN_TEST_DIST_DIR`, `NODE_ENV`. Not re-scanned; the local backend work likely changed it. For local runs the README (read 2026-11-02, handoff) names `APP_SESSION_SECRET`, `APP_PUBLIC_URL="http://127.0.0.1:3000"` and `SMTP_FROM` plus the values in `.env.database.local` (not opened). (2026-11-04: `playwright.config.ts` sets `APP_HOST`, `APP_PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_SCHEMA`, `APP_SESSION_SECRET`, `APP_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` for each of the three browser servers; no `APP_RUNTIME_MODE`.)
