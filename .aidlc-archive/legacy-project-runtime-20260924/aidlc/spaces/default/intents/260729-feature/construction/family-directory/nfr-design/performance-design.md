# Performance Design

## Query Strategy

Use indexed active-link, scope, group, and school-year predicates; paginate administrative lists and project only required fields. Cache only non-sensitive reference data within request scope.

Sources: `../nfr-requirements/performance-requirements.md`; `../functional-design/business-logic-model.md`.
