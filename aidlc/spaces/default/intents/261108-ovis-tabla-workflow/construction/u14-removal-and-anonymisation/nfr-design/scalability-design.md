# Scalability Design: u14-removal-and-anonymisation

Sources: this Unit's `scalability-requirements.md`, `performance-requirements.md`, `reliability-requirements.md`, `security-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`, its `functional-spec.md`, and contract C16 in `contract-summary.md`. Contains no names or contact details.

## Design

- **Work is per family.** Every statement in a removal is filtered by the subject's family or parent ids, so its cost depends on that family's records only, not on the size of the community (NFR5.5, NFR5.6).
- **Narrow locks.** Only the subject's family row, its tasks and its places, plus the rows each step owns for the subject, are locked (NFR5.7). Shared rows such as a duty that another family also holds are locked only for the instant a step updates them, in the C1 order.
- **No background job.** Several families leaving at year end are removed one after another by the administrator; each request is independent.

## Capacity Note

At about 20 families and a few years of history the busiest family has a few hundred rows across all kinds; this is well inside one request.
