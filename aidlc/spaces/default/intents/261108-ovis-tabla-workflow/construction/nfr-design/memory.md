<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-10T08:25:00Z [unit u2-first-rota-slice] — Asked no questions because the NFR requirements and the approved functional design already fix every pattern; publishing uses set-based inserts rather than one duty-function call per week, which keeps the 5-second target easy.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-09T07:33:31Z [unit u1-community-foundation] — The structure change is one migration file that opens its own transaction, because the runner adds none and old rules must never run against the new structure; the cost is one large file to review.
- 2026-11-09T07:33:31Z [unit u1-community-foundation] — The clean-start deletion has no guard of its own and is recorded as an accepted risk; a guard would have to tell test data from real data, and real data cannot exist before the hosting work.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
