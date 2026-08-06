# Performance Requirements

## Targets

Scheduler dispatches due jobs within 60 seconds of their target time at normal load; delivery status writes are asynchronous and do not delay user mutations.

## Verification

Use clock-controlled job fixtures for 7-day/24-hour timing and dispatch latency.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
