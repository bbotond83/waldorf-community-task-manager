# API Documentation

## HTTP Route Handlers

| Method and path | Input / output | Failure and security boundary |
|---|---|---|
| GET `/api/readiness` | 200 `{status,mode,marker}`; 503 `{status,code}` | Config readiness only; no real-target health probe |
| POST `/api/synthetic/session` | Form `profileId`, one of five profile IDs; empty ID signs out; cookie set/deleted and 303 to `/` | 400 malformed input/invalid ID; 403 origin rejection; 404 outside synthetic mode; signed HttpOnly/Lax cookie; successful selection sends `Clear-Site-Data: "cache"` |
| POST `/api/synthetic/reset` | 200 `{state,code,fixtureVersion}`; resets synthetic parent/admin/advanced stores | Synthetic-only and same-origin restriction |

No public business REST/GraphQL service layer was discovered. The session endpoint performs local synthetic authentication; it does not establish live-provider authentication behavior.

## Server Actions and Page Boundaries

`app/belepes/actions.ts` and `app/meghivas/[token]/actions.ts` expose parent authentication/invitation acceptance and resend boundaries. `app/szulo/actions.ts` owns five parent mutations; `app/admin/actions.ts` eight core actions; `app/admin/advanced-actions.ts` eight advanced actions. They accept `FormData`, validate IDs/text/version/idempotency inputs, derive session role/scope and return typed presentation states. Successful operations commonly call `revalidatePath`.

Pages include root selection/shell, login/invitation/denied states, parent duties/detail/requests/notifications, staff schedules/detail, and admin records/tasks/approvals/archive/import/reminders/privacy/settings. Role layouts and pages enforce protected session boundaries independently. Root login completion and business-page navigation are distinct flows.

## Internal Contracts

- `ApplicationResult<T>`: success, empty, validation, denied, conflict, invalidated, retryable/terminal dependency failure and recovery variants.
- `FacadePipeline`: authorization before adapter execution, projection and optional idempotency handling.
- Application ports: admin 25 operations; parent eight; staff schedule one; session gateway six.
- Domain ports: repository/audit/event/clock injection; import transaction preview/commit/rollback and notification queue/dispatcher/provider boundaries.

## External Integration Contracts

`SupabaseRouteAdapter` accepts an injected RPC client and calls `authorization_version_for` and `has_active_scope`; SQL also defines `has_admin_scope`. Supabase schema proposes six application tables, RLS and these authorization RPCs. Notification providers, durable persistence and deployment ports remain unverified against real targets. No actual external API request was performed in this scan.
