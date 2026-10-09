# API Documentation

## Route handlers
| Method path | Purpose | Notes |
|---|---|---|
| POST /api/synthetic/session | Select or clear a synthetic profile | Same-origin check; empty `profileId` clears cookie; valid id sets signed cookie; 303 to `/`; 400 `SYNTHETIC_PROFILE_INVALID`, 403 `REQUEST_ORIGIN_DENIED`, 503 outside synthetic mode |
| POST /api/synthetic/reset | Reset synthetic fixture state | Used by browser tests (`resetSyntheticParentState` and peers) |
| GET /api/readiness | Readiness probe | `{status:"ready",mode}` or 503 with config error code |
| GET munkatars/beosztas, /[id] | Schedule route handlers for colleagues | Teacher compatibility routes |

## Server actions
- app/szulo/actions.ts: `signUpAction`, `requestSwapAction`, `requestCancellationAction` (both call `revalidateParentDuty` on success), `markNotificationReadAction` (input `id`, `idempotencyKey`; validates identifier and key; returns `ParentActionState` with `link`; no `revalidatePath`), `updateContributionAction`.
- app/admin/actions.ts: `saveRecordAction` (title via `normalizeRequiredText` max 120, payload `{title, kind}`, revalidates /admin/nyilvantartasok), `archiveRecordAction`, `restoreRecordAction`, `saveTaskAction` (payload `{title, kind task|event, scenario}`, revalidates /admin/feladatok), `assignTaskAction` (scenario), `decideApprovalAction`, `saveEventNotesAction`; app/admin/advanced-actions.ts: import, reminders (`retryReminderAction`), lifecycle, settings. All return `AdminActionState` (`initial|validation|success|denied|conflict|invalidated|retryable|terminal`).
- app/belepes/actions.ts: parent synthetic login, returns `destination` (parent home).
- app/meghivas/[token]/actions.ts: accept and resend invitation.

## Page routes (Hungarian paths)
Public: /, /belepes, /meghivas/[token], /hozzaferes-megtagadva. Parent: /szulo/feladatok, /szulo/feladatok/[id], .../csere, .../lemondas, /szulo/ertesitesek. Teacher: /teacher/schedule, /teacher/schedule/[id]. Admin: /admin, /admin/nyilvantartasok(+/uj,/[id]), /admin/feladatok(+/uj,/[id]), /admin/jovahagyasok(+/[id]), /admin/archivum(+/[id]), /admin/emlekeztetok, /admin/adatvedelem, /admin/beallitasok, /admin/import.

## Internal contracts
`NavigationItem {id,label,href}`, `AdminItemModel {id,title,state:string,version?}`, `NotificationModel {id,title,link,isRead,timing,providerStatus}` (src/application/contracts.ts:147-148), `DutyListItemModel.state` / `DutyDetailModel` (state available|full|ineligible|assigned|swap-pending|cancellation-pending, `assignmentId?`, `version`), `RequestModel {id,state:"pending"}`. Authorization: `AUTHORIZATION_MATRIX` version `four-role-v1`.

## Query parameters
`state`, `q` (admin lists; values active|archived|open|pending offered by the filter), `status` (reminders: retryable|sent|stale), `allapot` (parent duty filter and back link), `scenario` (parent csere/lemondas, admin feladatok/[id] and jovahagyasok/[id], test-only outcome selector), teacher filter params via app/teacher/_lib/filters.ts.
