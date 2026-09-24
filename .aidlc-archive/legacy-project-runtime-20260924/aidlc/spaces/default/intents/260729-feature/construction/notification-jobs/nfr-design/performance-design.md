# Performance Design

## Dispatch Path

An authenticated scheduler queries the durable job table by `(state, due_at)` at a short fixed interval and hands due work to bounded worker batches. Assignment mutations only enqueue or cancel idempotent job records; delivery and outcome writes run outside the request path. The scheduler records queue delay so normal-load jobs can be dispatched within 60 seconds.

## Verification

Clock-controlled fixtures cover the 7-day and 24-hour reminders, batch contention, and a 60-second dispatch-delay assertion. Dashboards track queue age, claim duration, delivery latency, and failed-job count.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
