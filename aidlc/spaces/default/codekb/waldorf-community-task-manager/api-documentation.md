# API Documentation

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## HTTP, Actions, Pages and Internal APIs

Three explicit HTTP route handlers:

| Endpoint | Input / protection | Outcome |
| --- | --- | --- |
| `GET /api/readiness` | Runtime config composition; no auth requirement | 200 stable mode/status/marker; 503 stable config error |
| `POST /api/synthetic/session` | Synthetic mode only; Origin and Host equality; form `profileId` | 303 to `/` and rotated signed HttpOnly Lax cookie; empty ID clears cookie; 400 invalid form/profile; 403 origin denied; 404 unavailable in production |
| `POST /api/synthetic/reset` | Synthetic mode only; same origin | Resets process-local parent/admin/advanced fixtures; stable fixture-version success; 403/404 otherwise |

Server-action surfaces: parent login; invitation accept/resend; parent signup, swap, cancellation, notification-read and contribution update; admin record save/archive/restore, task save/assignment, approval decision and event notes; advanced import preview/resolve/commit/recover, reminder retry, grant revoke, lifecycle run and settings save. These are framework action invocations, not a public versioned REST API.

Page surfaces inventoried: `/`, `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`; `/szulo/feladatok` and detail/swap/cancel, `/szulo/ertesitesek`; `/munkatars/beosztas` and detail; `/admin` plus record/task/approval/archive lists/details/new forms, import, reminders, privacy, settings. Layouts and actions resolve sessions independently of navigation visibility.

Internal APIs: `AccessService.authorize/grantRole/revokeRole`; `AuthorizationContract.authorize/navigation`; `SessionApplicationFacade` resolve/select/switch/invitation/navigation; `ParentApplicationFacade` duty and notification operations; `StaffApplicationFacade.getSchedule/getScheduleEntry`; admin facade core operations and import/reminder/governance/lifecycle/settings subfacades. `SupabaseRouteAdapter` exposes RPC `authorization_version_for` and `has_active_scope`. SQL also defines `has_admin_scope`; no concrete Supabase client/SDK dependency is installed in the application manifest.

## Authorization Contracts

Application matrix version `2026-08-12.1`: eight typed rows plus explicit group-admin import denial; contract row IDs and role home/navigation map have consumers. `GrantModel` restricts displayed grants to three admin roles. Verification JSON separately defines 16 rows, version `waldorf-authz-v1`; reference integrity does not prove executable semantics match. Actor/scoped grants and projected result states are privacy boundaries.

## Session and Failure Behavior

Signed cookie payload stores profile ID/version. Missing profile or version mismatch invalidates it. Layout/action gates are independent. Unknown domain role strings can enter the terminal staff-like read branch with matching scope, and SQL role text is unconstrained. Removed/unknown roles and old profile cookies need explicit requirements. See [dependencies](dependencies.md).

## External Integration Limits

Supabase RPC is an adapter port, with intended SQL/RLS; no SDK/target linkage or executed migration is established. Real persistence, scheduler/provider, Vercel and Safari evidence remains outstanding.
