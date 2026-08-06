# Reliability Design

## Commit Boundary

One transaction writes assignment/request state and redacted audit evidence. A durable outbox records `assignment.changed`; worker retries reminder replacement until acknowledged.

Sources: `../nfr-requirements/reliability-requirements.md`; `../functional-design/business-logic-model.md`.
