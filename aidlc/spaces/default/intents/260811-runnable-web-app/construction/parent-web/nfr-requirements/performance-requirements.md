# Parent Web Performance Requirements

## Sources

Derived from [business logic](../functional-design/business-logic-model.md), [requirements](../../../../inception/requirements-analysis/requirements.md), and [technology stack](../../../../../../codekb/waldorf-community-task-manager/technology-stack.md).

## Targets

Invitation/auth, duties list/detail, signup/request, notifications, and notes complete within two seconds across documented repetitions on the 30-family synthetic fixture. Pending/duplicate-disable appears immediately. Lists are bounded; server-first rendering minimizes client JS; safe filter/context persists through detail and recovery.

## Measurement

Record fixture/version/browser/viewport/start/end/result. Beyond two seconds announce continued loading, then terminate in data or explicit failure. Local results exclude real network/provider latency.

