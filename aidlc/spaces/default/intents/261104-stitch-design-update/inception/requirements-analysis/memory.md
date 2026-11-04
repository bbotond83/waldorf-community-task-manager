<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-04T08:00:00Z — kept requirements at Standard depth with six owner questions; most scope (ten screens, Hungarian copy, accessibility, linter, pins) was already decided in earlier stages, so no stories or separate NFR stage are needed.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-04T08:00:00Z — Reviewer advisory findings to settle at the gate or in later stages: map the ten starred Stitch screens to flows and routes; confirm whether /szulo/feladatok already shows a parent's own signups (if not, FR3.5 may be new behaviour); require Latin-extended glyphs (ő, ű) in the bundled fonts; existing Hungarian wording wins over differing Stitch wording.
