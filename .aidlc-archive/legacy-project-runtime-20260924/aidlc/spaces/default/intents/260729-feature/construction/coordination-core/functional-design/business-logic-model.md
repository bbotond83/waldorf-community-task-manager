# Business Logic Model

## Assignment Transactions

Signup verifies active family eligibility/capacity and commits assignment with a version check. Qualified two-family swaps update both assignments atomically; other swaps await scoped approval. Cancellation approval releases assignment; rejection preserves it. Every mutation emits reminder-replacement and redacted-audit events.

## Conflict Handling

Concurrent or stale versions, capacity breaches, and competing requests commit no state and return a retryable conflict outcome.

Sources: `../../../inception/units-generation/unit-of-work.md`; `../../../inception/units-generation/unit-of-work-story-map.md`; `../../../inception/requirements-analysis/requirements.md`; `../../../inception/application-design/components.md`; `../../../inception/application-design/component-methods.md`; `../../../inception/application-design/services.md`.
