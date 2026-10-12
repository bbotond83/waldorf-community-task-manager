<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations

## Tradeoffs
- 2026-10-12 [unit u1-local-platform-and-audit] — audited changes go through named database functions (not triggers on every table): explicit and reviewable, at the cost that a direct write to an audited table is not auditable by itself.

## Open questions
- 2026-10-12 [unit u1-local-platform-and-audit] — the audited-action list names only the categories of FR3.5; exact action names are fixed in code generation.
