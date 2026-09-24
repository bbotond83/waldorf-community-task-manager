# Performance Requirements

## Targets

Scoped group/date schedule reads complete within 2 seconds at normal 30-family load; pagination/range validation prevents unbounded retrieval.

## Verification

Measure p95 schedule projection by group/date range with synthetic data.

Sources: `../../functional-design/business-logic-model.md`; `../../../inception/requirements-analysis/requirements.md`.
