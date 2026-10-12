<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-10-12 — keyed the requirement-to-unit map by FR because no user stories exist in this plan; each FR has one implementing unit and an "also touches" column.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-10-12 — five coarse units (owner Q2-B) instead of eight: fewer construction rounds, but U2, U3 and U4 are XL; Functional Design must split U3 by owning block.

## Open questions
- 2026-10-12 — session, invitation and grant-change numbers are still open; NFR Requirements of U2 must fix them. Staged import payload policy is settled in U4 Functional Design.
