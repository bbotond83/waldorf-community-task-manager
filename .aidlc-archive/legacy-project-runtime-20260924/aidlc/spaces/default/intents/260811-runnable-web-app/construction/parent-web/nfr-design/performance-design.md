# Parent Web Performance Design

## Sources

Implements [performance](../nfr-requirements/performance-requirements.md), [security](../nfr-requirements/security-requirements.md), [stack](../nfr-requirements/tech-stack-decisions.md), and [logic](../functional-design/business-logic-model.md).

## Design

Server components request bounded authorized duty/notification models. Detail routes fetch one object. Server actions revalidate affected cards/lists only. URL filters and intended destination preserve context. Client JS is limited to pending/disclosure/focus; card markup is shared across breakpoints.

## Budget Verification

Measure invitation, duties, mutation, and notification scenarios on versioned fixtures. Announce after threshold and terminate explicitly; never leave indefinite loading.

