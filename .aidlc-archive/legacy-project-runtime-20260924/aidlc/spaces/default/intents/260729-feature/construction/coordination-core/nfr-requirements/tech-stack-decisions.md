# Technology Stack Decisions

## Decisions

Use Postgres transactions and optimistic version columns through TypeScript domain services; durable job records publish post-commit reminder work.

## Rationale

This enforces conflict-free responsibility transitions without microservice coordination.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
