# Performance Design: u5-reminders-and-email

Sources: `nfr-requirements/performance-requirements.md`, `functional-spec.md`, `rules.md`, `technology-stack.md`. No cache, queue or service is added: the data is small (about 40 parents) and every list is one database call.

## Notice list (NFR9.1, NFR9.2, NFR9.3)

`notification_list` stays one function call from the app. Inside it, one query selects the caller's notices, newest first and limited to a page of 50, and a loop over those 50 rows calls the target type's facts function with `EXECUTE` (name from the registry, quoted, pinned search path) to build each title, date and path. The plan test covers the outer query. The app makes no further request per notice. The page-open path calls no reminder or send function (BR53.5), so no page waits for delivery.

## Delivery-problems screen (NFR9.1)

One list function returns failed-email groups and recent failed check records in one result. Groups come from a single grouped query over failed deliveries, titled by the kind's label and the item's date with no facts call (no reading parent exists on this screen); check records are limited to 30 days.

## Indexes (NFR9.4)

| Table | Index | Serves |
|---|---|---|
| email delivery | (status, next_attempt_at) where status in queued, retry_wait | the claim |
| email delivery | (claimed_at) where status = sending | the expiry sweep (BR51.4) |
| email delivery | (kind, target type, target id, status) where status = failed | the failure groups |
| notice | (parent id, created_at desc) | the notice list |
| timed check run | (run id), (created_at) | the screen and the housekeeping check |
| email attempt | (delivery id) | the tries of a delivery |

The plan test loads 10,000 invented rows, turns sequential scans off for the session and checks each query uses its index.

## Delivery pass and run budgets (NFR9.5, NFR9.6, NFR9.7)

The pass loop is in the app's timed command, not the database: claim a batch of 10 (one function call, `for update skip locked`, oldest first), send each with a 30-second timeout, record each outcome, repeat until 50 are claimed or 2 minutes have passed. Unclaimed emails are never touched, so they stay queued with no try counted. The daily run is one database function call; every check runs in a sub-block with its own exception handler, so a failure undoes only that check's rows. The run keeps its locks until it ends, which the `lock_step` ordering makes safe, and the checks stay small and set-based (the duty-reminder check selects due jobs once, not per family).

## Screens (NFR8.1, NFR8.2)

"Kézbesítési hibák" reuses the admin list layout and the `admin-` classes, wraps long titles with the existing wrapping rule, and is designed in Stitch first; it works at phone width and by keyboard and passes the browser accessibility checks in `verify:local`. Timing requirements are measured on the `db:seed:large` set. Text is Hungarian in the screens, the refusal messages and the email template.
