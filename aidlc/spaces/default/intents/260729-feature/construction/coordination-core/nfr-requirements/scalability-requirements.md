# Scalability Requirements

## Capacity

Use indexed task/date/group/assignment state predicates and optimistic versions; avoid broad participant joins in list views.

## Trigger

Investigate capacity when p95 mutations exceed target or conflict rate grows above expected normal-load behavior.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
