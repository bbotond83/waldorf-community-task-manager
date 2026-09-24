# Application Facades Domain Types

## Sources and Scope

These application-boundary types implement [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md). They are not persistence entities and do not replace owned domain aggregates.

## Core Types

- `RuntimeMode = synthetic | production`.
- `SessionContext`: subject ID, authorization version, roles/scopes, synthetic flag; no credential.
- `AuthorizationContractRow`: stable row ID, role, scope predicate, route/action/resource/field set, allow/deny code.
- `SensitiveFieldId`: email, phone, locality, optional profile, protected reason, participant name, unrelated family.
- `ApplicationState`: the approved exhaustive screen-state union.
- `ApplicationResult<T>`: state, stable code, optional safe data/field errors, focus target, announcement, optional retry/evidence.
- `IdempotencyContext`: key, operation, actor reference, aggregate/version, first-seen result.
- `ApplicationEvent`: ID, type, aggregate ID/version, occurredAt, idempotency key, redacted payload.
- `EvidenceReference`: scenario/story/requirement/matrix IDs, execution target, result, timestamp, location.

## Authorized View Models

`NavigationModel`, `DutyList/DetailModel`, `NotificationModel`, `ScheduleModel`, `DashboardModel`, `RecordModel`, `Task/Event/AssignmentModel`, `ApprovalModel`, `ImportModel`, `ReminderModel`, `GrantModel`, and `LifecycleModel` contain only fields allowed by their authorization row. Constructors accept authorized domain projections, not raw repository records.

## Invariants

- A denied result carries no data or retry.
- Only retryable dependency failure carries retry metadata.
- Evidence/log envelopes reject raw personal/free-text/provider/secret fields.
- Production sessions cannot be synthetic; synthetic fixtures cannot contain real-data provenance.
- Idempotency key plus operation uniquely identifies one mutation result.
