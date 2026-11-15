# API Documentation

There is no public REST API. The surfaces are the screens with their server actions, three small HTTP handlers, internal TypeScript ports, and the named database functions.

## HTTP Handlers

| Method and path | Purpose | Auth |
|---|---|---|
| GET `/api/readiness` | Returns `{status:"ready", marker:"waldorf-local-ready"}`, or 503 when configuration is invalid | None |
| GET `/munkatars/beosztas`, `/munkatars/beosztas/[id]` | 307 redirect from old teacher links | None |

## Screens

| Area | Routes |
|---|---|
| Public | `/`, `/bejelentkezes`, `/jelszo-visszaallitas`, `/jelszo-visszaallitas/uj`, `/meghivas/[token]`, `/hozzaferes-megtagadva` |
| Parent | `/szulo/ertesitesek` (home), `/szulo/feladatok`, `/szulo/feladatok/[id]`, `/szulo/feladatok/[id]/csere`, `/szulo/feladatok/[id]/lemondas`, `/szulo/cserek` |
| Teacher | `/teacher/schedule` (home), `/teacher/schedule/[id]` |
| Admin, both admin roles | `/admin`, `/admin/nyilvantartasok`, `/admin/nyilvantartasok/uj`, `/admin/nyilvantartasok/[id]`, `/admin/feladatok`, `/admin/feladatok/uj`, `/admin/feladatok/[id]`, `/admin/jovahagyasok`, `/admin/jovahagyasok/[id]`, `/admin/archivum`, `/admin/archivum/[id]` |
| Admin, super admin only | `/admin/import`, `/admin/emlekeztetok`, `/admin/adatvedelem`, `/admin/beallitasok` |

That is 29 page routes.

## Server Actions

| File | Actions |
|---|---|
| `app/szulo/actions.ts` | `signUpAction`, `requestSwapAction`, `respondToSwapAction`, `withdrawRequestAction`, `requestCancellationAction`, `markNotificationReadAction`, `updateContributionAction` |
| `app/admin/actions.ts` | `saveRecordAction`, `archiveRecordAction`, `restoreRecordAction`, `saveTaskAction`, `assignTaskAction`, `decideApprovalAction`, `saveEventNotesAction` |
| `app/admin/advanced-actions.ts` | `uploadImportWorkbookAction`, `resolveImportConflictAction`, `commitImportAction`, `recoverImportAction`, `cancelImportAction`, `retryReminderAction`, `updateGrantAction`, `runLifecycleAction`, `saveAdvancedSettingsAction` |
| `app/_identity/`, `app/bejelentkezes/`, `app/jelszo-visszaallitas/`, `app/meghivas/` | Sign-in, sign-out, password reset, invitation acceptance |

Actions answer with a state object: `initial`, `validation`, `success`, `denied`, `conflict`, `invalidated`, `retryable` or `terminal`, plus a Hungarian message.

## Internal Ports

| Port | Location | Methods |
|---|---|---|
| `ParentApplicationPort` | `src/application/parent-facade.ts` | `listDuties`, `getDuty`, `signUp`, `requestSwap`, `requestCancellation`, `listSwapCandidates`, `respondToSwap`, `withdrawRequest`, `listSwapRequests`, `listNotifications`, `markNotificationRead`, `updateOwnContribution` |
| `AdminApplicationPort` | `src/application/admin-facade.ts` | `execute({operation, scope, payload, idempotencyKey})` with 27 operations: dashboard, records, tasks, assignments, approvals, notes, import, reminders, governance, lifecycle, settings |
| `TeacherApplicationPort` | `src/application/teacher-facade.ts` | `getSchedule` |
| `AuthorizationVersionPort` | `src/application/authorization.ts` | `getCurrentVersion`, `clearProtectedCache` |
| `WorkbookParser` | `src/import-parser/types.ts` | Bytes to rows or the first failed check |
| `DatabaseClient` | `src/runtime/database/client.ts` | `callOperation`, `read`, `forSession` |
| `SignInService` | `src/identity/service.ts` | Password sign-in, refresh, sign-out, recovery, new password |

## Authorization Matrix

Defined in `src/application/authorization.ts` (`four-role-v1`), mirrored by `verification/authorization-matrix.json`.

| Row | Roles | Resources |
|---|---|---|
| `AUTH-PARENT-DUTIES` | parent | family, assignment, swap_request, cancellation_request, contribution |
| `AUTH-PARENT-NOTIFICATIONS` | parent | notification |
| `AUTH-TEACHER-TRACKING` | kindergarten_teacher | schedule, coordination |
| `AUTH-GROUP-ADMIN-CORE` | group_admin | dashboard, record, task, assignment, approval, archive |
| `AUTH-GRP-IMPORT-DENY` | group_admin | import, explicitly denied |
| `AUTH-SUPER-ADMIN` | super_admin | all of the above plus import, reminder, lifecycle, settings |
| `AUTH-SUPER-GOVERNANCE` | super_admin | role_grant, governance |

Note that the database's `reminder_list` and `reminder_retry` would allow a group admin, but the application matrix does not.

## Database Functions

All return JSON with `state`, `reference` and `code` unless noted. Commands take `p_idempotency_key`; most take an expected version.

### Directory and settings

| Function | Caller | Notes |
|---|---|---|
| `directory_save(key, family)` | admin in reach | Family, parents, contacts, children, memberships in one call. Limits: 10 parents, 20 children. Linking an account is super admin only |
| `structure_save(key, kind, payload)` | super admin | School year or group. A group's school year cannot change |
| `directory_archive_item`, `directory_restore_item` | super admin; child: admin in reach | Group, school year, child |
| `directory_parent_profile(parent)` | self, admin in reach | Returns text, not an envelope |
| `settings_get`, `settings_save` | read: admin; save: super admin | Reminders on or off, recipients `duty` or `group` |

### Coordination

| Function | Caller | Refusal codes |
|---|---|---|
| `event_save`, `event_save_notes` | admin in reach | `VERSION_CONFLICT`, field errors |
| `task_save` | admin in reach | Capacity below taken, event group mismatch; cancelling removes places |
| `duty_list`, `duty_get` | parent | `no_family`, `duty_not_found` |
| `duty_sign_up` | parent | `DUTY_VERSION_STALE`, `DUTY_CLOSED`, `DUTY_ALREADY_ASSIGNED`, `DUTY_INELIGIBLE`, `DUTY_FULL` |
| `assignment_assign`, `assignment_remove` | admin in reach | `ASSIGNMENT_INELIGIBLE`, `ASSIGNMENT_CAPACITY_FULL`, `VERSION_CONFLICT` |
| `contribution_save` | parent | Own place only; 500 characters |
| `swap_candidates`, `swap_request`, `swap_respond`, `swap_incoming`, `swap_withdraw` | parent | `REQUEST_CONFLICT`, `REQUEST_DUPLICATE`, `REQUEST_VERSION_STALE`, `SWAP_CANNOT_BE_APPLIED`, `SWAP_REQUEST_NOT_OPEN` |
| `cancellation_request` | parent | `DUTY_CLOSED`, `REQUEST_DUPLICATE` |
| `swap_decide`, `cancellation_decide` | admin in reach | `APPROVAL_ALREADY_DECIDED`, `APPROVAL_INVALIDATED`; writes an audit event |
| `schedule_get(group, from, to)` | teacher, group admin, super admin | `VAL-DATE-RANGE`: at most 31 days between two given dates |
| `family_archive`, `family_restore` | admin in reach | `VERSION_CONFLICT`, `RESTORE_CONFLICT` |
| `dashboard_get` | admin | Counts only |

### Governance and lifecycle (super admin)

`governance_list`, `governance_revoke` (`GRANT_STALE`, `GRANT_SELF_LOCKOUT`, `GRANT_LAST_SUPER_ADMIN`), `lifecycle_list`, `lifecycle_run` (`LIFECYCLE_STALE`, `LIFECYCLE_BLOCKED`, `LIFECYCLE_CONFIRMATION_REQUIRED`), `lifecycle_hold_place`, `lifecycle_hold_release`.

### Notifications

`notification_list`, `notification_mark_read` (parent); `reminder_list`, `reminder_retry` (admin in reach, `REMINDER_NOT_RETRYABLE`, `REMINDER_STALE`); `reminder_run_due` (any member); `reminder_run_due_system` (service role).

### Import (starting super admin)

`import_preview_create`, `import_conflict_resolve`, `import_status`, `import_cancel`, `import_mark_interrupted`, `import_commit`, `import_recover`, `import_expire`; `import_expire_system` (service role). Codes include `IMPORT_PREVIEW_STALE`, `IMPORT_CONFLICT_UNRESOLVED`, `IMPORT_FINGERPRINT_CHANGED`, `IMPORT_MATCH_CHANGED`, `IMPORT_RECOVERY_NOT_AVAILABLE`, `IMPORT_RECOVERY_ACTION_INVALID`.

The parser adds `IMPORT_MALFORMED`, `IMPORT_OVERSIZED`, `IMPORT_MISSING_SHEET`, `IMPORT_MISSING_HEADER`, `IMPORT_UNSAFE_CELL`.

### Identity

- Signed-in: `invitation_create`, `invitation_resend`, `invitation_revoke`, `grant_change`, `account_deactivate`, `account_reactivate`, `account_find_by_email`, `scope_probe`.
- Service role, before a session: `invitation_lookup`, `invitation_reserve`, `invitation_release`, `invitation_accept`, `sign_in_lockout_check`, `sign_in_attempt_record`, `sign_in_attempt_clear`, `account_recovery_check`, `sessions_remove`, `identity_housekeeping`, `operator_first_super_admin`.
- Hook: `password_verification_hook`, called by the sign-in service.

## Workbook Template Contract

`src/import-parser/template.ts` and the `sheet_registry` table hold the same list of 17 sheets, 8 interactive and 9 archive (a database test keeps them in step). Limits: 5 MB file, 50 MB expanded, 20,000 rows per sheet, 100,000 in total, 10,000 characters per cell.

- Directory headers: `Csoport`, `Család`, `Szülő neve`, `E-mail`, `Telefon`, `Helység`, `Gyermek neve`, `Opcionális profil`, `Hozzájárulás`.
- Task headers: `Csoport`, `Esemény`, `Feladat`, `Kategória`, `Kezdés`, `Befejezés`, `Helyszín`, `Létszám`, `Család`.
- Dates are `YYYY-MM-DD HH:mm` in Budapest time. Commit requires the fingerprint and confirmation.

## Fixed Value Lists That New Features Must Extend

| Column | Values |
|---|---|
| `app_role_grants` role and scope (`current_role_scope`) | parent on family, group_admin and kindergarten_teacher on group, super_admin on organization |
| `assignments.status` | active, swap_pending, cancellation_pending, removed |
| `assignments.source` | parent_sign_up, admin_assign, swap, import |
| `tasks.status`, `events.status` | open, closed, cancelled; planned, cancelled |
| `change_requests.kind`, `status` | swap, cancellation; open, applied, approved, rejected, withdrawn |
| `notifications.kind` | sign_up_confirmed, swap_requested, swap_decided, cancellation_decided, place_removed, reminder_7d, reminder_24h |
| `notifications.target_type` | task, change_request (with `task_id` required) |
| `reminder_jobs.threshold` | 7d, 24h |
| `audit_events.action` | role, approval, import, lifecycle and account actions |
