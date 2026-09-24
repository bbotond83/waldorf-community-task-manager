# Admin Core Web Performance Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Targets

- Dashboard, records, tasks/events, assignments, approvals, and archive server responses/render-ready models complete within 2 seconds across documented repetitions on the 30-family fixture.
- Pending text/control disable appears in the first rendered action state without waiting for completion.
- Filter/result navigation preserves state and avoids full unrelated route reloads.
- Lists use bounded result sets/pagination; no route serially loads unrelated dashboard panels.
- At 320px/200% zoom, card layouts avoid two-dimensional scrolling and retain all permitted actions.

## Measurement

Record scenario, fixture version, route/action, start/end boundary, browser/runtime, repetitions, and result. Synthetic measurements do not claim Supabase/network latency.

