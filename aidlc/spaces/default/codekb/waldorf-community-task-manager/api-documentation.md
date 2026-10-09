# API Documentation

## HTTP Route Handlers

| Method and path | File | Behaviour |
|---|---|---|
| GET `/api/readiness` | `app/api/readiness/route.ts` | Readiness probe used by Playwright web servers and start smoke |
| POST `/api/synthetic/session` | `app/api/synthetic/session/route.ts` | Form field `profileId` (zod enum: `parent-local`, `kindergarten-teacher-local`, `group-admin-local`, `super-admin-local`; empty string clears the cookie). 503 outside synthetic mode, 403 on cross-origin, 400 on invalid body/profile, otherwise 303 to `/` |
| POST `/api/synthetic/reset` | `app/api/synthetic/reset/route.ts` | Resets synthetic state for tests (same-origin) |
| GET `/munkatars/beosztas`, `/munkatars/beosztas/[id]` | `app/munkatars/beosztas/*` | Legacy 307 redirect to teacher schedule via `compatibilityLocation` |

## Pages (UI routes)

- Entry `/`; parent login `/belepes?tovabb=`; parent `/szulo/feladatok[?allapot=]`, `/szulo/feladatok/[id]`, `/csere`, `/lemondas`, `/szulo/ertesitesek`.
- Admin `/admin`, `/admin/feladatok[?q=&state=]`, `/admin/jovahagyasok[?q=&state=]`, `/admin/nyilvantartasok[?q=&state=]`, detail pages, `/admin/import`, `/emlekeztetok`, `/adatvedelem`, `/beallitasok`, `/archivum`.
- Teacher `/teacher/schedule[?groupId=&from=&to=]`, `/teacher/schedule/[id]`.
- Invitation `/meghivas/[token]`, `/hozzaferes-megtagadva`.

Admin list filter vocabulary (`AdminFilterBar.tsx`): `state` in `active|archived|open|pending` plus free text `q`. Item states in synthetic data: `active`, `archived`, `open`, `scheduled`, `pending`, `approved` (`src/admin-core/synthetic-admin.ts`). Parent duty filter `allapot` values: `available|full|ineligible|assigned|swap-pending|cancellation-pending`.

## Internal Application Ports

`src/application/` exposes `ParentApplicationPort` (listDuties, getDuty, signUp, swap/cancel requests, notifications), `AdminApplicationPort` (`getDashboard`, `listRecords`, `listTasks`, `listApprovals`, detail and mutation operations), `TeacherApplicationPort`, `SessionGateway`. All return `ApplicationResult<T>` (states in `contracts.ts:48-63`). `NavigationItem = { id, label, href }` drives the shell navigation.

## Server Actions

`authenticateParentAction`, parent `signUpAction`/`updateContributionAction` and swap/cancel actions, admin and advanced-admin mutations, invitation actions.

## Contract Constraints for UI Work

No API contract change is needed for the intent: profile selection keeps the `profileId` form POST; list/detail routes and query parameters stay as above.
