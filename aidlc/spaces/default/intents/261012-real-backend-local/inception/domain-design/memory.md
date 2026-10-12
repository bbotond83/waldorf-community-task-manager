<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-12T13:02:34Z — Read the person's Q6 answer ("simplified") as: result states, facade pipeline, idempotency and projection guard stay, and visibility moves into database policies owned by Access (ADR-006); I did not drop the application-level authorization hand-off entirely because the screens still need explicit denied states.
- 2026-10-12T13:02:34Z — Modelled WebApp, ApplicationKernel and DevelopmentTooling as components next to the eight domain blocks because each is code we write with its own responsibilities, even though the person only named the eight blocks; the traceability maps tooling requirements (start, seed, reset, CI setup) to DevelopmentTooling.
- 2026-10-12T13:02:34Z — The five major review points of the approved requirements (numbers for lifetimes, first super admin, workbook history check, contact visibility for every role and read path, per-worker account isolation) are not design-stage decisions; I carried them forward as inputs for NFR Requirements and Functional Design instead of inventing values here.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
