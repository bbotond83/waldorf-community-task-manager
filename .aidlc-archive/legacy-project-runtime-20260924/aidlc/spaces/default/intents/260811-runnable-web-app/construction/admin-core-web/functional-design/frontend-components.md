# Administrator Core Frontend Components

## Sources

Components implement approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Route Components

- `AdminDashboardPage`: scoped summary cards and panel-local states.
- `RecordsPage`, `RecordDetailPage`, `RecordForm`, `ArchiveRestoreAction`.
- `TasksEventsPage`, `TaskEventForm`, `AssignmentForm`, `EventNotesForm`.
- `ApprovalsPage`, `ApprovalDetailPage`, `ApprovalDecisionForm`, `ApprovalOutcomePanel`.
- Shared `AdminScopeContext`, `AdminFilterBar`, `ResponsiveCollection`, `ErrorSummary`, `MutationAction`, `AsyncStatePanel`.

## Component Contracts

Props are authorized view models and explicit application states only. Forms use visible labels/fieldset, error-summary links, pending disable, idempotency hidden field, expected version, and safe cancel/back. No component accepts raw aggregate, role string as authorization, exception, arbitrary HTML, or sensitive-field dictionary.

## Responsive and Accessibility

Mobile uses filter disclosure, labelled cards, detail pages, and in-flow actions. Desktop may use tables/two-pane approval views with equivalent card/list alternative. DOM/focus order remains filters → results → detail → fields/reason → actions → status. Route changes focus H1; validation focuses summary; denial/error focuses state heading; success announces politely without focus movement.

## Authorization Rendering

Navigation/actions are supplied by authorized models. Group Admin sees scoped core operations but no Import or super-admin governance. Denied deep links render generic `Nincs jogosultság` with no protected content/count/field. Protected approval reasons render only when the final matrix grants the request type.
