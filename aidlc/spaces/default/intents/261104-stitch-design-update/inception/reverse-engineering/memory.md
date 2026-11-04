<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-04T07:00:00Z — chose a focused scan (app/, tests/browser/, proxy.ts) over a full rescan; the work is a UI-only restyle, so src/identity and src/runtime were demoted to shallow coverage in the code map (the comparison reported NARROWER for those two paths).

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-04T07:00:00Z — "Saját vállalásaim" (a starred Stitch screen) has no page, route or string in the app; the owner must say which existing screen it maps to, or confirm it is out of scope for a UI-only restyle.
- 2026-11-04T07:00:00Z — Font delivery (next/font/local vs @font-face under public/fonts) and whether to delete the unused profile-picker CSS (about 100 lines) are still undecided.
