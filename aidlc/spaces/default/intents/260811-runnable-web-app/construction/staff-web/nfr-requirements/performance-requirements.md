# Staff Web Performance Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), [requirements](../../../../inception/requirements-analysis/requirements.md), and [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Targets

Schedule list, filter, and detail responses complete within two seconds across documented repetitions on the versioned 30-family synthetic fixture. Loading feedback appears immediately, the date range is limited to 31 days, result sets are bounded, and server-first rendering minimizes client JavaScript while preserving filters through detail and retry.

## Measurement

Record fixture version, staff profile, granted group, browser, viewport, date range, start/end time, and result. A response exceeding two seconds announces continued loading and terminates in data or an explicit retryable or terminal state. Local measurements exclude real Supabase and provider latency.
