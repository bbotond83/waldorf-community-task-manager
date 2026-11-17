<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-10T08:25:00Z [unit u2-first-rota-slice] — Asked no questions because the NFR requirements and the approved functional design already fix every pattern; publishing uses set-based inserts rather than one duty-function call per week, which keeps the 5-second target easy.
- 2026-11-14T07:30:00Z [unit u3-directory-and-profile] — The 30-day clearing of finished email requests counts from decidedAt, or from expiresAt for expired ones, so no job has to mark expiry.

- 2026-11-16T11:02:00Z — [unit u6-full-rotas-and-weekend-picks] Asked no NFR design questions; the unit adds no service, cache or scheduler, and every design follows the patterns U2 and U5 already use (one read function per page, one transaction per command, registry rows for notices and checks).

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-14T07:30:00Z [unit u3-directory-and-profile] — Removing a parent deletes their pending email-change request outright (the new address is a required field, so cancelling would keep it); this refines BR36.3, which only says cancel. The audit row keeps the fact without the address.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-09T07:33:31Z [unit u1-community-foundation] — The structure change is one migration file that opens its own transaction, because the runner adds none and old rules must never run against the new structure; the cost is one large file to review.
- 2026-11-09T07:33:31Z [unit u1-community-foundation] — The clean-start deletion has no guard of its own and is recorded as an accepted risk; a guard would have to tell test data from real data, and real data cannot exist before the hosting work.
- 2026-11-14T07:30:00Z [unit u3-directory-and-profile] — The password-change audit row is written by the app server after the sign-in service confirms, not in one transaction; a failed write is an event line and the change stands, so the parent is never locked out.
- 2026-11-14T07:30:00Z [unit u3-directory-and-profile] — The resend limit counts accepted sends only, in a small table keyed by the hashed address, under a per-hash advisory lock so two requests at once cannot both take the last slot; new refusal code EMAIL_RATE_LIMITED.
- 2026-11-15T13:50:00Z [unit u4-working-groups] — Join takes share locks on the family and parent rows, so it waits for a removal running at the same time instead of racing it; the cost is a short wait, and no lock is ever taken in the opposite order.
- 2026-11-15T13:50:00Z [unit u4-working-groups] — A new unit test checks the authorization matrix has a row per group route and role, because the existing checks stay green without such rows (the remaining minor point of the NFR requirements review).

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
