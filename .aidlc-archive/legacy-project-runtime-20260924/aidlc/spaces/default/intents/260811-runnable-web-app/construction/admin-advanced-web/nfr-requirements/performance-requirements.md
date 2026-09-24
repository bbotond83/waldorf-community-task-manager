# Administrator Advanced Web Performance Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), approved [requirements](../../../../inception/requirements-analysis/requirements.md), and brownfield [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Targets

- Each import select/validate/preview/conflict/confirm/commit/recovery response completes within two seconds on the versioned bounded synthetic workbook fixture; preview and outcome lists are paginated or bounded.
- Reminder, governance, lifecycle, recipient, and settings list/detail/action responses complete within two seconds on the 30-family fixture.
- Pending feedback and duplicate-disable appear in the first action state; every operation terminates in success, blocked/conflict/stale/denied, retryable, or terminal state.
- Route, filter, step, and safe resolution context survives detail and recovery without reprocessing unrelated data.
- At 320px and 200% zoom, stepper, comparison, job, grant, and lifecycle views avoid two-dimensional scrolling and retain all permitted actions.

## Measurement

Record fixture/workbook version, actor/scope, step or operation, payload bounds, browser/runtime, repetitions, start/end boundaries, and result. Synthetic job, persistence, and provider timings do not claim linked-target performance.
