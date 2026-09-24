# Performance Requirements

## Targets

Signup, swap, cancellation, and approval API responses complete within 2 seconds at normal 30-family load; transaction lock duration stays minimal.

## Verification

Measure p95 mutation latency and conflict rate under concurrent synthetic requests.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
