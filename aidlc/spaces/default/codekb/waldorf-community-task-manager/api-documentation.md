# API Documentation

## Route handlers
| Method path | Purpose | Notes |
|---|---|---|
| POST /api/synthetic/session | Select or clear a synthetic profile | Same-origin check; empty `profileId` clears cookie; valid id sets signed cookie; always 303 to `/` (app/api/synthetic/session/route.ts:33,35,46); 400 `SYNTHETIC_PROFILE_INVALID`, 403 `REQUEST_ORIGIN_DENIED`, 503 outside synthetic mode |
| POST /api/synthetic/reset | Reset synthetic fixture state | Used by browser tests |
| GET /api/readiness | Readiness probe | `{status:"ready",mode}` or 503 with config error code |
| GET munkatars/beosztas, /[id] | Schedule route handlers for colleagues | Teacher compatibility routes |

## Server actions
- app/szulo/actions.ts: sign up, swap, cancel, contribution, `markNotificationReadAction` (:70-92; input `id`, `idempotencyKey`; returns `ParentActionState` with `link`).
- app/admin/actions.ts, app/admin/advanced-actions.ts: records, tasks, assignments, approvals, import, reminders, lifecycle, settings.
- app/belepes/actions.ts: parent synthetic login, returns `destination` (default /szulo/feladatok).
- app/meghivas/[token]/actions.ts: accept and resend invitation.

## Page routes (Hungarian paths)
Public: /, /belepes, /meghivas/[token], /hozzaferes-megtagadva. Parent: /szulo/feladatok, /szulo/feladatok/[id], .../csere, .../lemondas, /szulo/ertesitesek. Teacher: /teacher/schedule, /teacher/schedule/[id]. Admin: /admin, /admin/nyilvantartasok(+/uj,/[id]), /admin/feladatok(+/uj,/[id]), /admin/jovahagyasok(+/[id]), /admin/archivum(+/[id]), /admin/emlekeztetok, /admin/adatvedelem, /admin/beallitasok, /admin/import.

## Internal contracts
`NavigationItem {id,label,href}`, `NavigationModel {homePath,items}`, `AdminItemModel {id,title,state:string,version?}`, `NotificationModel {id,title,link,isRead,timing,providerStatus}`, `DutyListItemModel.state` enum, `TrackingEntry` (src/application/contracts.ts). Authorization: `AUTHORIZATION_MATRIX` version `four-role-v1`.

## Query parameters
`state`, `q` (admin lists, state values active|archived|open|pending), `allapot` (parent duty filter), teacher filter params via app/teacher/_lib/filters.ts.
