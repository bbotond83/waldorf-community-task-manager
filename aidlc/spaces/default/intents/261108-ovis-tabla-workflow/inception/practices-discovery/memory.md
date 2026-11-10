<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-08T10:16:46Z — Read "go-live" as an open deployment decision, not a settled fact; the migration is meant to run at go-live and the spreadsheet is to be retired, but nothing is hosted and this scope skips every Operation stage. The draft assumes no destination and puts the question first in the interview list.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-08T10:16:46Z — Marked unaffirmed text in team-practices.md with [To confirm]; the draft has to show new practices, but only rules already affirmed may sit in discovered-rules.md. New rule wording waits in evidence.md, and the markers must be removed at integration.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-08T10:16:46Z — Proposed a per-rule test checklist for SQL instead of a coverage percentage; the 80% figure only counts TypeScript and JavaScript and most new rules will be SQL. A checklist needs no new tooling and matches how tests/database already works, but it depends on review rather than a measured number.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-08T10:16:46Z — The privacy scan cannot detect personal names and skips aidlc/; the repository is public and the anonymiser has known gaps. Names are protected only by discipline until a stronger check exists, so the owner needs to decide when the anonymised copy can be read.
