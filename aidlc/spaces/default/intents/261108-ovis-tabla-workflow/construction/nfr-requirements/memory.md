<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-25T19:08:20Z [unit u14-removal-and-anonymisation] — Carried the design review's two Major findings into this stage as requirements (read the account ids before the steps run, so sessions really end; lock task rows then place rows right after the family row) and its Minor findings on the last super admin and the DUTY_ROTA_MANAGED test; the reviewed design files are frozen, and the gate shows both the finding and where it is now required.
- 2026-11-25T19:08:20Z [unit u14-removal-and-anonymisation] — The owner's Q2 (replace a single removed parent's name at once) changes BR207.1's assumption and the design's open point; it is a stricter privacy rule on the same records, recorded here as NFR1.4 rather than by editing the frozen rules file.
- 2026-11-09T07:30:54Z [unit u1-community-foundation] — Asked no questions because requirements.md and the approved contracts already fix the targets; the 2-second list target is measured on the 30-family seed, which exceeds the required 20.

- 2026-11-10T07:56:00Z [unit u2-first-rota-slice] — Asked no questions because requirements.md, the contracts and the approved functional design already fix the targets; the 5-second target for making and publishing a full-year draft is mine, since requirements.md only sets the 2-second list target.

- 2026-11-15T13:40:00Z [unit u4-working-groups] — Asked no questions; requirements.md, the contracts and U4's reviewed design fix every target, and U5 already owns email delivery and failures.
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Closing the general role-change function for group_admin covers revoking too, with the refusal after the authorization check; the design's second review asked this to be stated, and one way in means both directions.

- 2026-11-16T05:56:00Z — [unit u6-full-rotas-and-weekend-picks] Asked no NFR questions; every target follows from NFR1 to NFR11, the U2 targets for the same pages (2 seconds a page, 5 seconds for draft and publish) and the unit's own rules, so no questions file was written.
- 2026-11-23T14:40:00Z [unit u11-checklists-and-templates] — Asked no NFR questions; the targets follow from NFR1 to NFR11, U10's targets for the same event page (2 seconds), and U11's rules. Added a 1-second target for taking and finishing a task, because the row updates in place and parents tap many tasks in a row at a big cleaning.

- 2026-11-24T17:35:00Z [unit u12-todo-and-my-tasks] — Asked no NFR questions; targets follow from NFR1 to NFR11, U10/U11's 2-second page and 1-second command targets, and U12's rules. Added NFR3.25 (re-check that the caller is still an active parent after the task row is locked), taken from the Functional Design review's first major finding. The NFR review (READY) left six minor wording points for the unit checkpoint: NFR3.25 is stricter than BR182.1/182.3/183.2; NFR3.23 "no row looked up" and "same audit entry"; NFR3.24 "give back" vs administrators "free"; no requirement for another community's task or event answering as not found; NFR4.23 omits no_parent_record, too_many_tasks, status_not_allowed; NFR9.16 needs a number.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-24T04:25:00Z [unit u8-animal-care-and-information] — Section text is shown by a small renderer of the app's own rather than a Markdown package; the allowed formatting is four constructs, a new package would need a pinned version and review, and an own renderer that never emits raw HTML is easy to test for script injection.
- 2026-11-24T04:25:00Z [unit u8-animal-care-and-information] — Saving the slot calendar and creating slots are audited like rota publishing, although NFR4 lists only rota publishing; both are administrator changes that move or create many families' duties at once. Sign-up, give-up and section edits are not audited.
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Joining and leaving are not audited; NFR4 does not list them and the membership row keeps join, end and reason, so an audit row would only duplicate it.
- 2026-11-15T13:40:00Z [unit u4-working-groups] — Family erasure keeps deleting memberships rather than ending them; erasure removes history by design, so the ended-rows-stay rule covers leaving and removal only.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
