# Staff Web Logical Components

## Sources

Derived from [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Components

`StaffScheduleRoute` owns list/filter orchestration; `StaffScheduleDetailRoute` owns single-row detail; `StaffScheduleFacade` resolves authorized results; `StaffScheduleProjection` constructs the field allowlist; `ScheduleTable` and `ScheduleCardList` render the shared view model; `AsyncStatePanel` renders empty, denied, retryable, and terminal outcomes; shared runtime/session/navigation components supply composition and accessible shell behavior.

## Isolation

Routes depend only on the staff façade and shared runtime contracts. Staff presentation cannot import parent/admin routes, adapters, repositories, Supabase clients, raw domain aggregates, or mutation handlers. Failures are contained to the current route/request, and no protected response is retained in a shared client cache.
