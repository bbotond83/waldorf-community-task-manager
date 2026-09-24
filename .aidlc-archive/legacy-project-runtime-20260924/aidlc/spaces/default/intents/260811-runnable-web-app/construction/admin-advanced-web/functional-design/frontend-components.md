# Administrator Advanced Frontend Components

## Sources

Components implement approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Route Components

- `ImportPage`, `ImportStepper`, `WorkbookInput`, `ImportValidationPanel`, `ImportPreview`, `ConflictResolutionForm`, `ImportConfirmation`, `ImportOutcomePanel`, `ImportRecoveryPanel`.
- `ReminderMonitorPage`, `ReminderFilterBar`, `ReminderJobDetail`, `ReminderRetryAction`.
- `GovernancePage`, `GrantList`, `GrantEditor`, `RevocationOutcomePanel`.
- `PrivacyLifecyclePage`, `LifecycleCandidateList`, `LifecycleDetail`, `LifecycleAction`.
- `AdvancedSettingsPage`, `RecipientSelector`, `SettingsForm`, plus shared `AsyncStatePanel`, `ErrorSummary`, `MutationAction`, and `ResponsiveCollection`.

## Component Contracts

Props contain authorized projections and explicit result states only. Mutation forms include visible labels, scoped choices, expected version, stable idempotency key, and fingerprint/correlation where required. No component accepts workbook bytes after preview creation, raw provider body, database aggregate, session store, unrestricted recipient list, protected lifecycle reason, exception, or role string as proof of authorization.

## Interaction and Accessibility

Import preserves completed steps and safe conflict choices through validation and retry, while preventing commit until all required resolutions and confirmation are valid. Monitoring filters survive detail/retry. Destructive governance/lifecycle actions name scope and consequence in their confirmation. Route changes focus H1; validation focuses the linked error summary; denied, blocked, recovery, and terminal states focus their heading; pending actions disable duplicates and announce; success announces without unexpected focus movement. Mobile and 200% zoom use labelled cards and single-column in-flow actions with 44×44 targets.

## Authorization Rendering

Navigation and actions come from authorized models. Group Administrators receive no import or super-administrator governance element; Kindergarten Administrators receive import and permitted organization settings but no super-administrator grant controls; Super Administrators receive governance subject to last-admin and self-lockout invariants. Denied deep links reveal no preview, counts, candidate existence, recipient, or job detail.
