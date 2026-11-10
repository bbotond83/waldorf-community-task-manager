<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Sign-up, assignment and swaps no longer depend on working-group membership; contracts C2 and C18 give parents the whole community and list no membership refusal, so today's membership checks go in U1 rather than waiting for U6 or U7.
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Group-wide reminders reach families with an active member parent, and every family for a community-wide task; requirements are silent and U5 replaces the mechanism, so this keeps today's setting working.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Indoor-cleaning card text is a short fixed Hungarian sentence; the sources hold no cleaning instructions, only "no fixed day" (FR5.7), so detailed text waits for the information page and the owner corrects the wording in the screenshot review.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Every active family counts as full-year in the draft; family standing (leaving, new) is U6's, so the part-year half of AC5.1.2 and AC5.1.3 are traced to U6.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Left isCoordinator off WorkingGroupMembership although components.md lists it; the unrevoked group-admin grant is the single record, because ADR-010 keeps grants in Identity and a second copy could disagree.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — U2 also builds the C5 place functions and C18 place_mark_done although no U2 screen uses them; the contracts name U2 as provider, and leaving them would make U7 and U9 reach back into U2.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Today's notices are tied to one task, so the publishing notice adds one kind to them (rota_published) rather than waiting for U6's notification function; contract C8 said U2 would use today's function unchanged.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — The six groups load from one repository list used by the seed rather than a dedicated install function; a function would be speculative until the hosting work exists, and that work must load the same list.
- 2026-11-09T07:11:20Z [unit u1-community-foundation] — Teachers read events through the schedule only, with no new table right; event rows hold notes other readers must not see, and U10 adds a proper events read.

- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Published is final in U2, so a mistake means a local reset until U7 can change duties; the alternative, an unpublish step, would need rules for notices already sent and duties already created.
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — Rota duties are refused by today's change functions (DUTY_ROTA_MANAGED) rather than left editable, because an edit through the old task form would break the rota's one-family-per-week link until U7 moves those functions.

## Open questions
- 2026-11-10T08:05:00Z [unit u2-first-rota-slice] — The teacher's overview route is only proposed; confirm it in the Stitch design.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
