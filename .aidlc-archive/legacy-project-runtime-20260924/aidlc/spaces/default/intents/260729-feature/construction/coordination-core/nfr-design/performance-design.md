# Performance Design

## Mutation Budget

Use short Postgres transactions with indexed assignment/task/group predicates and optimistic version checks. Instrument p95 mutation latency and conflict rate; defer reminder work until after commit.

Sources: `../nfr-requirements/performance-requirements.md`; `../functional-design/business-logic-model.md`.
