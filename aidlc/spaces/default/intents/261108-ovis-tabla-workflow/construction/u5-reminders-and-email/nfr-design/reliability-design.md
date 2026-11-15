# Reliability Design: u5-reminders-and-email

Sources: `nfr-requirements/reliability-requirements.md`, `rules.md`, C8 and C9. Nothing is hosted; the owner starts the timed command, so recovery is "run it again".

## Outbox pattern (NFR7.1)

`notice_send` writes the notice and a queued delivery row inside the caller's transaction and never contacts a mail server. The mail server is reached only by the timed command, after commit. A failing mail server therefore cannot undo a feature's change.

## Retry rounds (NFR7.2, NFR7.3, NFR7.6)

```
queued --claim--> sending --sent--> sent
                         --fail, try < 3--> retry_wait (due +15 min) --claim--> sending
                         --fail, try = 3--> failed --Try again--> queued (round + 1)
sending, claimed > 10 min --sweep--> counted as failed, reason claim_expired
```

The sweep runs first in each pass. Claims are batches of 10; each send has a 30-second timeout, so a batch finishes in at most 5 minutes, below the 10-minute expiry. The notice mailer enforces one overall timeout per send (an abort around the whole send, not the library's per-phase timeouts), tested with a slow server. No new batch starts after 2 minutes. Emails never claimed count no try. At-least-once delivery is accepted: a pass that stops after a send but before recording may deliver twice after expiry.

## Failure isolation in the run (NFR7.4, NFR7.5, NFR7.7)

The run loops over active checks in name order. Each check runs in a sub-block with an exception handler: on error its changes are undone, a failed record with the database error code is written, and the loop continues. A check whose function does not exist is recorded as missing. Checks run in ascending `lock_step` then name (see scalability-design.md), so the one-transaction run keeps the contract lock order. A missed day sends what is due next time because checks decide from state (job due dates, once keys), not from the date of the last run.

## Migration safety (NFR7.8, NFR7.9)

One forward-only migration: add registries and seed every existing kind and target type; add the due-date column filled from the old scheduled moment's Budapest date; mark jobs in simulated states cancelled; create the delivery, attempt, run and check tables; drop the simulated attempt table. Each existing notice kind gets a facts function that reproduces today's title, including full titles for the state-dependent swap decisions and rota_published. The test reads one notice of every kind before and after and compares titles.

## Verification and testing (NFR6.1 to NFR6.5, NFR7.10, NFR11.1)

Database tests follow the fixed list per rule, in files added to `test:database:*` and to the shuffled run. Application tests use a fake mail transport for sent, unavailable and rejected; one integration check sends through the local mail catcher; one test runs the timed command with no session. Tests of the removed simulated delivery and member tick go in the same pull request. `npm run verify:local` stays the merge gate, with the 80% line, branch and function coverage thresholds unchanged (NFR6.1).
