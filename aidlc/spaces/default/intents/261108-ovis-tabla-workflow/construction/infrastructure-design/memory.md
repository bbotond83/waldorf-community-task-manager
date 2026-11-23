<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-21T09:40:00Z [unit u13-lending-library] — Asked no questions; nothing is hosted and the NFR design adds no service, so the design only records that the unit adds database objects, registry rows and seed data to the existing local set-up.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-11-22T13:05:00Z [unit u9-recurring-duties] — Asked no infrastructure questions; nothing is hosted and the unit adds only database objects, registry rows and screens. The two Major points of the NFR Design review (lock list per command, rota-week renumbering after a republish) and its minor points (one failing schedule, execute right for the service-role entry point, skipped families and groups, C1 amendment in the contract summary) are decided in the "Settled for Code Generation" table of the infrastructure specification, because the NFR design files are frozen after review.
