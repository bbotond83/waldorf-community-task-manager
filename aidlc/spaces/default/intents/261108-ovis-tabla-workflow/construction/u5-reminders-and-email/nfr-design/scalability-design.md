# Scalability Design: u5-reminders-and-email

Sources: `nfr-requirements/scalability-requirements.md`, `rules.md`, C1 and C9. One community, about 40 parents, a few thousand rows a school year. No partitioning, queue service or scaling rule is needed; concurrency correctness is the design concern.

## Concurrency patterns

| Pattern | Used for | Requirement |
|---|---|---|
| `for update skip locked` on due deliveries, oldest first, limit per batch | two passes at once never take the same email | NFR5.1 |
| Claim sets status sending and counts the try in the same statement; the record function matches on (id, status = sending, round, try number) | repeat-safe outcomes | NFR5.2 |
| Unique key on (parent, once key) with `on conflict do nothing`, counted by rows returned | repeated or overlapping `notice_send` and runs | NFR5.3 |
| Duty-reminder check selects due jobs `for update`, ordered by id, and marks each sent in the same transaction as its notices | two overlapping checks send each job once | NFR5.4 |
| Try again: the screen sends the group key and the list of (delivery id, try count) it showed. Under ascending-id locks the call is refused with REMINDER_STALE when any listed email is no longer failed or its try count differs. Otherwise it restarts exactly the listed emails; a failure that joined the group after the screen was shown is not listed, stays failed and shows on the next view, with no refusal | two admins, outdated screen, late failures | NFR5.5, NFR5.6 |
| Idempotency key for Try again stored by the existing use-case template | repeated click | NFR5.5 |

## Lock order (NFR5.7)

Family row, task rows ascending, assignment rows ascending, as C1 requires. New locks are taken after them: job rows ascending, delivery rows ascending. Within the daily run (one transaction) every registered check carries a `lock_step` (1 family rows, 2 task rows, 3 assignment rows, 4 jobs, deliveries and other rows) and the run calls checks in ascending `lock_step`, then name. A check that takes family rows must register step 1, so a later unit's check can never take a family row after an earlier check holds duty rows. Later units declare the step when they register the check, and the registry rejects a check without one. The duty-reminder check reads the family and duty state without locking them for update; it locks only job rows, so it cannot invert the order. Removal takes the family row first (from U14's call), then delivery rows ascending.

## Growth

The housekeeping check keeps run, check and delivery tables small (90 and 30 days). The notice list is limited to a page of 50 newest, with a "load more" using the notice id as cursor if the screen needs it.
