<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-12T12:45:07Z — Used the product requirements document in source-materials as the authoritative source for sign-in, invitation and role requirements (FR-001, FR-002, FR-003, section 9.3) although the earlier stages had not cited it; the person's answers (four roles, uuids, invitation only) override its five-role set where they differ.
- 2026-10-12T12:45:07Z — The person's Q12 answer (the committed workbook holds real personal data) was turned into a privacy requirement (FR11) and a history-purge step the owner performs, because the file is tracked in git and the repository carries it in its history.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
