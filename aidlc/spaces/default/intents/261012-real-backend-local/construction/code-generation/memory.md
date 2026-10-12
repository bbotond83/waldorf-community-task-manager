<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-10-12 [unit u1-local-platform-and-audit] — the Supabase CLI publishes its ports on all interfaces with no loopback option, so the start command checks every non-loopback address and requires an explicit acknowledgement flag; the designed loopback-only binding was not achievable.
- 2026-10-12 [unit u1-local-platform-and-audit] — the verification command set PATH for Node 24 only on its first part, so the tests ran on Node 26 and failed; the corrected command uses export so every part runs on Node 24.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
