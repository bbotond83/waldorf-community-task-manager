# Performance Requirements

## Targets

- Family/child relevance queries and mutations support 30 families at normal load.
- Protected directory API p95 remains within the 2-second core API target; pagination/filtering prevents unbounded reads.

## Verification

Use synthetic family fixtures and scope-filter benchmarks.

Sources: `../../functional-design/business-logic-model.md`; `../../functional-design/business-rules.md`; `../../../inception/requirements-analysis/requirements.md`.
