# Component Methods

## Public Contracts

- `access.authorize(actor, action, resource): Decision`
- `family.getVisible(actor, familyId): FamilyView`
- `coordination.signUp(actor, taskId): Assignment`
- `coordination.requestSwap(actor, assignmentId, counterpartId): SwapRequest`
- `coordination.decideRequest(actor, requestId, decision): Outcome`
- `import.createPreview(actor, workbook): ImportPreview`
- `import.resolveConflict(actor, previewId, resolution): ImportPreview`
- `import.commit(actor, previewId): ImportResult`
- `privacy.runLifecycle(familyId): LifecycleOutcome`

## Additional Contracts

- `access.grantRole(actor, subject, role, scope): RoleGrant`; `access.revokeRole(actor, grantId): void`
- `directory.saveFamily(actor, input): Family`; `directory.archive(actor, record): void`
- `coordination.saveEventNotes(actor, eventId, input): Event`; `coordination.scheduleReminders(assignmentId): void`
- `jobs.enqueue(type, payload, idempotencyKey): Job`; `jobs.recordDelivery(jobId, outcome): void`
- `import.rollback(actor, runId): ImportResult`; `import.recover(actor, runId): ImportResult`

## Errors

All contracts return `ValidationError`, `AuthorizationDenied`, `Conflict`, `NotFound`, `UnsafeInput`, or `RecoverableFailure`; mutations return a redacted audit ID.

All methods return typed validation/authorization/conflict errors; privileged operations emit redacted audit evidence.
