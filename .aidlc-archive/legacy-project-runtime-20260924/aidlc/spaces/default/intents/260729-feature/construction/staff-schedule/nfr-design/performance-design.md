# Performance Design

## Schedule Projection

The schedule API returns a compact, pre-scoped projection for the selected group and date range, with assignment status and event location but no contact details. Indexed group/date queries and server-side pagination keep protected reads within the 500 ms p95 target; the client renders loading and empty states without blocking navigation.

## Verification

Measure group and cross-group administrator views at the 30-family MVP profile, including a congested mobile network. Track API p95, render-ready time, and failed projection requests; the core schedule flow must become visible within two seconds.

Sources: `../nfr-requirements/performance-requirements.md`; `../nfr-requirements/tech-stack-decisions.md`; `../functional-design/business-logic-model.md`.
