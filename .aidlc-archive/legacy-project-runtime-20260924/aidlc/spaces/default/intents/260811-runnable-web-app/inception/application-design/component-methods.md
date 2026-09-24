# Component Methods

## Contract Conventions

Methods below implement the [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), observed CodeKB [architecture](../../../codekb/waldorf-community-task-manager/architecture.md), [component inventory](../../../codekb/waldorf-community-task-manager/component-inventory.md), and [team practices](../practices-discovery/team-practices.md). Expected failures return `ApplicationResult<T>`; unexpected adapter failures are caught at the application boundary and mapped without exposing raw error text.

```ts
type ApplicationState =
  | "initial" | "loading" | "empty" | "validation" | "pending" | "success"
  | "denied" | "conflict" | "invalidated"
  | "dependency-failure-retryable" | "dependency-failure-terminal" | "recovery";

type ApplicationResult<T> = {
  state: ApplicationState;
  code: string;
  data?: T;
  fieldErrors?: Record<string, string>;
  focusTarget: string;
  announcement: "none" | "polite" | "assertive";
  retry?: { idempotencyKey: string; action: string };
  evidenceId?: string;
};
```

## Session and Authorization

- `session.resolve(request): Promise<ApplicationResult<SessionContext>>`
- `session.selectSynthetic(profileId, intendedPath?): Promise<ApplicationResult<SessionContext>>`
- `session.switchSynthetic(profileId): Promise<ApplicationResult<SessionContext>>`
- `session.acceptInvitation(token, input): Promise<ApplicationResult<AuthDestination>>`
- `session.resendInvitation(identifier): Promise<ApplicationResult<void>>`
- `authorization.navigation(session): Promise<ApplicationResult<NavigationModel>>`
- `authorization.authorize(session, matrixRowId, resource): Promise<ApplicationResult<AuthorizedContext>>`
- `authorization.revoke(actor, grantId, idempotencyKey): Promise<ApplicationResult<RevocationOutcome>>`

Production composition rejects synthetic selection/switch/reset before session creation. Resend returns the same success contract for known and unknown identifiers. Revocation increments authorization version and invalidates protected cache on the next request.

## Parent Application

- `parent.listDuties(session, filter): Promise<ApplicationResult<DutyListModel>>`
- `parent.getDuty(session, dutyId): Promise<ApplicationResult<DutyDetailModel>>`
- `parent.signUp(session, dutyId, expectedVersion, idempotencyKey): Promise<ApplicationResult<AssignmentModel>>`
- `parent.requestSwap(session, input, idempotencyKey): Promise<ApplicationResult<RequestModel>>`
- `parent.requestCancellation(session, input, idempotencyKey): Promise<ApplicationResult<RequestModel>>`
- `parent.listNotifications(session, filter): Promise<ApplicationResult<NotificationListModel>>`
- `parent.markNotificationRead(session, notificationId, idempotencyKey): Promise<ApplicationResult<void>>`
- `parent.updateOwnContribution(session, eventId, note, idempotencyKey): Promise<ApplicationResult<EventNoteModel>>`

The façade composes existing Parent/Directory/Coordination services and converts domain denial/conflict into the shared state contract. No unrelated-family projection is created.

## Staff Application

- `staff.getSchedule(session, groupScope, range): Promise<ApplicationResult<ScheduleModel>>`
- `staff.getScheduleEntry(session, entryId): Promise<ApplicationResult<ScheduleEntryModel>>`

Models contain schedule fields and `SF-PARTICIPANT-NAME` only where required. No mutation method exists.

## Administrator Application

- `admin.getDashboard(session, scope): Promise<ApplicationResult<DashboardModel>>`
- `admin.listRecords(session, query): Promise<ApplicationResult<RecordListModel>>`
- `admin.getRecord(session, type, id): Promise<ApplicationResult<RecordDetailModel>>`
- `admin.saveRecord(session, input, idempotencyKey): Promise<ApplicationResult<RecordDetailModel>>`
- `admin.archiveRecord(session, id, expectedVersion, idempotencyKey): Promise<ApplicationResult<void>>`
- `admin.restoreRecord(session, id, expectedVersion, idempotencyKey): Promise<ApplicationResult<void>>`
- `admin.listTasks(session, query): Promise<ApplicationResult<TaskListModel>>`
- `admin.saveTaskOrEvent(session, input, idempotencyKey): Promise<ApplicationResult<TaskModel>>`
- `admin.assign(session, input, idempotencyKey): Promise<ApplicationResult<AssignmentModel>>`
- `admin.listApprovals(session, query): Promise<ApplicationResult<ApprovalListModel>>`
- `admin.decideApproval(session, requestId, decision, expectedVersion, idempotencyKey): Promise<ApplicationResult<ApprovalOutcome>>`
- `admin.saveEventNotes(session, eventId, input, idempotencyKey): Promise<ApplicationResult<EventNoteModel>>`

`decideApproval` has exact outcomes `approved`, `rejected`, `already-decided`, `invalidated`, `denied`, `dependency-failure-retryable`, and `dependency-failure-terminal`; only the retryable dependency result returns retry metadata and it reuses the original key.

## Import, Reminder, Governance, and Lifecycle

- `admin.import.createPreview(session, workbook, idempotencyKey): Promise<ApplicationResult<ImportPreviewModel>>`
- `admin.import.resolveConflict(session, previewId, resolution, idempotencyKey): Promise<ApplicationResult<ImportPreviewModel>>`
- `admin.import.commit(session, previewId, fingerprint, idempotencyKey): Promise<ApplicationResult<ImportOutcome>>`
- `admin.import.recover(session, runId, action, idempotencyKey): Promise<ApplicationResult<RecoveryOutcome>>`
- `admin.reminders.list(session, query): Promise<ApplicationResult<ReminderListModel>>`
- `admin.reminders.retry(session, jobId, idempotencyKey): Promise<ApplicationResult<ReminderOutcome>>`
- `admin.governance.updateGrant(session, input, expectedVersion, idempotencyKey): Promise<ApplicationResult<GrantOutcome>>`
- `admin.lifecycle.list(session, query): Promise<ApplicationResult<LifecycleListModel>>`
- `admin.lifecycle.run(session, familyId, expectedVersion, idempotencyKey): Promise<ApplicationResult<LifecycleOutcomeModel>>`

Group administrators fail authorization before any import method runs. Synthetic job/recovery methods use deterministic stores and failure fixtures; linked-target evidence remains `OUTSTANDING`.

## Composition and Evidence

- `composeApplication(config): ApplicationFacade`
- `validateRuntimeConfig(env): ApplicationResult<RuntimeConfig>`
- `synthetic.reset(fixtureVersion): Promise<ApplicationResult<void>>`
- `evidence.record(scenario): Promise<ApplicationResult<EvidenceReference>>`

`composeApplication` selects exactly one adapter set. `synthetic.reset` is unavailable outside synthetic mode. Configuration validation performs no target network call and never prints secret values. Evidence stores IDs, versions, results, browsers, timestamps, and locations only.

