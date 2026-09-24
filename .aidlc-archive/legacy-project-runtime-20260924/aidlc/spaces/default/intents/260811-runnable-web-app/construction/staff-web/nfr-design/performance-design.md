# Staff Web Performance Design

## Sources

Implements [performance requirements](../nfr-requirements/performance-requirements.md), [security requirements](../nfr-requirements/security-requirements.md), [stack decisions](../nfr-requirements/tech-stack-decisions.md), and [business logic](../functional-design/business-logic-model.md).

## Design

Server components request one bounded authorized schedule projection for a validated group and date range of at most 31 days. Detail routes request one schedule row. Filters remain in the URL so navigation, retry, and return do not require a client store. Client JavaScript is limited to form enhancement, focus, and status announcements; the server supplies semantic table and card markup from the same view model.

## Budget Verification

Measure list, filter, detail, empty, denied, retryable, and terminal scenarios against the versioned fixture in every required browser profile. Loading feedback is immediate; work exceeding the two-second target announces continuation and always terminates in content or an explicit state.
