# Performance Design: u14-removal-and-anonymisation

Sources: this Unit's `performance-requirements.md`, `scalability-requirements.md`, `security-requirements.md`, `reliability-requirements.md`, `observability-requirements.md` and `tech-stack-decisions.md`, its `functional-spec.md`, and contract C16 in `contract-summary.md`. Contains no names or contact details.

## Design

| Concern | Decision | Covers |
|---|---|---|
| Preview | One read calls the eleven step previews in order; each is a set-based count on indexed family or parent columns. No locks. | NFR9.1 |
| Removal | One transaction; each step updates its rows in one set-based statement where possible; no per-row loops beyond the existing ones in U3's directory core. | NFR9.2 |
| Flagged items | One read that unions the owners' flag reads filtered to the subject's family, limited to items flagged because the family is removed. | NFR9.3 |
| Later run | Reuses the steps (mostly zero work) plus one existence check per record kind. | NFR9.4 |
| Name helpers | The extra condition reads columns of rows the helpers already join (parent status, family status); no new join. | NFR9.5 |

No caching: removal is rare and must always see current data.

## Measurement

- A database test times the preview, the removal and the later run on the seed's busiest family; a browser test times the two pages. Each must stay under 2 seconds.
