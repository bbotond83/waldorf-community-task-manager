# Scalability Design

## Queue Capacity

Postgres indexes `(state, due_at)` for due-job claims and `(idempotency_key, state)` for active-job uniqueness. Workers claim small leased batches with `SKIP LOCKED`, allowing additional worker instances without duplicate sends. Job payloads stay compact by storing references only.

## Scaling Signals

Queue age above 60 seconds, increasing lease contention, or sustained batch saturation triggers a worker-capacity review. The MVP profile is 30 families, while the indexed claim model permits horizontal workers without redesigning producer flows.

Sources: `../nfr-requirements/scalability-requirements.md`; `../nfr-requirements/performance-requirements.md`; `../functional-design/business-logic-model.md`.
