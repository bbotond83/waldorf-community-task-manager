<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-09T07:30:54Z [unit u1-community-foundation] — Asked no questions because requirements.md and the approved contracts already fix the targets; the 2-second list target is measured on the 30-family seed, which exceeds the required 20.

- 2026-11-10T07:56:00Z [unit u2-first-rota-slice] — Asked no questions because requirements.md, the contracts and the approved functional design already fix the targets; the 5-second target for making and publishing a full-year draft is mine, since requirements.md only sets the 2-second list target.

- 2026-11-15T13:40:00Z [unit u4-working-groups] — Asked no questions; requirements.md, the contracts and U4's reviewed design fix every target, and U5 already owns email delivery and failures.
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Closing the general role-change function for group_admin covers revoking too, with the refusal after the authorization check; the design's second review asked this to be stated, and one way in means both directions.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Joining and leaving are not audited; NFR4 does not list them and the membership row keeps join, end and reason, so an audit row would only duplicate it.
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Family erasure keeps deleting memberships rather than ending them; erasure removes history by design, so the ended-rows-stay rule covers leaving and removal only.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
