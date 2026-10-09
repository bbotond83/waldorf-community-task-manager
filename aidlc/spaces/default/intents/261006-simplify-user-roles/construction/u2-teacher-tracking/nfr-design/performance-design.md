# Teacher Tracking Performance Design

## Bounded Fresh Reads

NFR2.22 and NFR1.21: perform one repository read for the authorized group/range per list or detail request, filter by inclusive UTC start-time bounds, then validate and project in memory. Detail finds its id within that same result. Real calendar validation and elapsed range limit 31 days prevent unbounded date requests. Do not add per-row identity queries, a permanent status/projection cache or automatic retries. Each request receives a current authority context; no cross-request cache can substitute for authorization.

## Verification and Budgets

NFR2.21: retain the existing configured timing/browser and build/start checks and capture their exact thresholds at implementation/verification; no additional SLA is invented. Source-spy checks establish zero reads on authorization denial and one read on an authorized query. Refetch tests mutate the same injected source, then verify current values. Fixture size and synthetic mode are reported with timing evidence. Remote timeout/capacity budgeting is outside this unlinked integration.

## Sources

[performance-requirements.md](../nfr-requirements/performance-requirements.md), [security-requirements.md](../nfr-requirements/security-requirements.md), [scalability-requirements.md](../nfr-requirements/scalability-requirements.md), [reliability-requirements.md](../nfr-requirements/reliability-requirements.md), [observability-requirements.md](../nfr-requirements/observability-requirements.md), [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md), [functional-spec.md](../functional-design/functional-spec.md), [contract-summary.md](../../../inception/contract-design/contract-summary.md).

