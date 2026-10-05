<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions

- 2026-10-05T09:15:54.469766+00:00 — Source inspection found a shared synthetic login path for all five profiles and no remote authentication call in that path. Prior timings used isolated warmed servers; the running user server and browser/compiler timings remain unmeasured. The current shell selects Node 26 although the project requires Node 24.

- 2026-10-05T09:07:37.168706+00:00 — The previous login scan has no source fingerprint; the user chose a full repository rescan. Actual local reproduction and per-profile timing remain required evidence for the fix.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
