# Parent Web Frontend Components

## Sources

Implements approved [units](../../../../inception/units-generation/unit-of-work.md), [story map](../../../../inception/units-generation/unit-of-work-story-map.md), [requirements](../../../../inception/requirements-analysis/requirements.md), Application Design [components](../../../../inception/application-design/components.md), [methods](../../../../inception/application-design/component-methods.md), and [services](../../../../inception/application-design/services.md).

## Components

- `InvitationPage`, `InvitationResendForm`, `AuthenticationEntry`, `UpcomingDutyNotice`.
- `ParentDutiesPage`, `DutyCard`, `DutyDetailPage`, `SignupAction`.
- `SwapRequestPage`, `CancellationRequestPage`, `RequestOutcomePanel`.
- `ParentNotificationsPage`, `NotificationCard`, `MarkReadAction`.
- `ContributionNotesForm`, shared `ErrorSummary`, `AsyncStatePanel`, `MutationAction`.

## Contracts

Props are authorized view models. Invitation tokens/raw account-existence state, other-family records, contacts, protected reasons, raw errors, and provider bodies never enter props. Forms carry idempotency/expected version and explicit field errors.

## Responsive and Accessibility

Mobile-first single-column cards; filters/actions remain reachable with 44×44 targets. One main/H1, skip link via shell, visible focus, labelled native controls, error-summary links, polite/asertive announcements as specified, 200% zoom/reflow, reduced motion.
