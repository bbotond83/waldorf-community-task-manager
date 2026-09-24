# Performance Design

## Responsive Parent Views

The parent dashboard fetches one family-scoped view model containing current assignments, eligible actions, and concise status. Server-rendered shell content, indexed assignment queries, and deferred secondary details keep protected reads within 500 ms p95 and make core flows visible within two seconds on a typical mobile connection.

## Verification

Measure dashboard, assignment detail, cancellation, and swap-request journeys at the MVP profile on mobile and desktop. Track API latency, largest-content-ready time, and action completion time; retain only redacted route and outcome telemetry.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
