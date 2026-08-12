# Admin Core Web Performance Design

## Sources

Implements [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Design

Dashboard panels use independent bounded façade queries and suspense/loading regions; one failure does not serialize/block unrelated panels. Collections use server filters, stable pagination, and compact authorized projections. Detail pages fetch one scoped aggregate plus required references, not full collections.

Server actions return pending immediately and revalidate only affected route/tag. Filter/search params persist in URL; returning from detail preserves query. Mobile card rendering uses the same model and no duplicate fetch.

## Budgets and Measurement

Measure request-to-render-ready result for each critical route/action across the 30-family fixture. Two seconds is terminal target; after threshold the UI announces continued loading and must end in data or explicit failure. Bundle/client JS is constrained by keeping pages server-first and client islands small.

