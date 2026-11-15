# Reliability Requirements: u5-reminders-and-email

Sources: NFR5, NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `contract-summary.md` (C8, C9). Nothing is hosted in this work (`technology-stack.md`), so no availability target applies; the owner starts the timed command by hand.

## Delivery Guarantees

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.1 | `notice_send` only queues email inside the caller's transaction; it contacts no mail server, so a mail failure never undoes the caller's change or the in-app notice (BR50.7, BR51.6). | A test with a failing mailer finds the caller's change and the notice kept. |
| NFR7.2 | A failed email is tried at most 3 times per round, 15 minutes apart, then shown to the super admin; Try again starts a new round (BR51.3, BR54.3). | Tests of the rounds with a fake mailer failing 1, 2 and 3 times. |
| NFR7.3 | A try claimed but never recorded counts as failed after 10 minutes with reason claim_expired and is retried; such an email may in rare cases arrive twice and is never lost silently (BR51.4). | A test stops a pass after the claim, ages it past 10 minutes and runs a pass. |
| NFR7.4 | One failing check never stops the others, and its failure is recorded with its database error code; a missing check function is recorded as missing (BR52.2). | A test registers a failing check and a missing one beside a good one. |
| NFR7.5 | A missed run sends what is due at the next run, and nothing depends on anyone signing in (BR52.7). | A test skips a day and runs the next with no session. |
| NFR7.6 | A delivery pass claims emails in batches of 10, each send has a 30-second timeout, and the pass starts no new batch after 2 minutes. Emails not yet claimed stay queued and count no try, so a pass is always far under the 10-minute claim limit (NFR9.5). | A slow-mailer test: 60 due emails, sends that time out, at most 50 claimed, the unclaimed ones still queued with no try counted. |
| NFR7.7 | Each check's changes are undone on their own if it fails, and a failed record stays; the outcome record is all-or-nothing. | Forced-failure tests for the duty-reminder check and the outcome record. |
| NFR7.11 | The mail adapter maps every send error to a reason class and drops the library's message, so no address or server reply reaches a log or a table. | A test fails the mailer with an error text holding an address and searches every log line and table for it. |

## Migration

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.8 | The structure change (registries, due date, new delivery, run and record tables, dropped simulated attempts) applies over U1 to U3's data without losing a notice or a reminder job; jobs in simulated states become cancelled and queued jobs keep their due date. | A test applies the migration over a seeded database and compares notice counts and job states. |
| NFR7.9 | The seed rows of every existing notice kind and target type (sign-up confirmed, place removed, swap approved, swap rejected, cancellation decisions, rota published and the reminder kinds) are in the registries, listed by name in the migration. Title model: a target type's facts function returns the item's name, date and path, and optionally a full title; a full title replaces the kind's prefix plus the name. Swap decisions and the item-less rota_published use full titles from their facts functions (BR50.4, aligned in this stage). | A test reads one notice of every seeded kind before and after the migration and compares the titles with the list. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Delivery Checks and Testing

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.10 | Every change passes `npm run verify:local`: type checking, tests, production build, start smoke, the critical browser flow without serious or critical accessibility violations, and dependency scanning. | The `Validate` check is green in all three browsers. |
| NFR6.1 | Application code keeps at least 80% line, branch and function coverage. | Coverage thresholds pass unchanged. |
| NFR6.2 | Every database rule has the fixed list: allowed, refused, out of reach, outdated screen, repeated click, two people at once, with a recorded reason where a case has no meaning. | The test plan has one row per rule, each cell naming a test or "nem értelmezhető" with its reason. |
| NFR6.3 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |
| NFR6.4 | Tests of the removed simulated delivery, member tick and old reminder functions change or go in the same pull request. | No test mentions them. |
| NFR6.5 | One integration check sends through the local test mailbox and reads the message; a separate test runs the daily command with no session. | Both pass in `verify:local`. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.1 | Lifecycle deletion and the removal step (C16) cover notices, emails, tries and reminder recipients of a leaving parent or family, and history stays readable with the person removed. | Lifecycle tests for a parent and a family, with preview counts equal to apply counts. |
