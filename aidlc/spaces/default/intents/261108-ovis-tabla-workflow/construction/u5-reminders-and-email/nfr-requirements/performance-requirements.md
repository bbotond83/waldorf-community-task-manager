# Performance Requirements: u5-reminders-and-email

Sources: NFR8 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `technology-stack.md`. The list pages to measure are the parent's notice list and the super admin's delivery-problems screen. Answers: Q2.

## Response Times

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.1 | The notice list ("Értesítések") and the delivery-problems screen ("Kézbesítési hibák") each load in under 2 seconds on the owner's computer. | Measured against the `db:seed:large` set (the one seed used by every timing requirement here), with its notices, emails and run records present. |
| NFR9.2 | The notice list is one request from the app to the database, and the facts functions run inside it. | A test counts the app's database requests for a list of 50 notices and finds one. |
| NFR9.3 | Opening any page runs no reminder and no mail send (BR53.5), so no page is slowed by delivery. | A test opens the notice list with a due job and finds it untouched. |
| NFR9.4 | The new tables have indexes for what the passes ask: due emails by next try, failed emails by group, run records by date. | A database test loads 10,000 invented rows, turns off sequential scans for the session, and finds each lookup uses its index. |

## Delivery and Run Budgets

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR9.5 | A delivery pass claims at most 50 emails in all, oldest first, in batches of 10, and starts no new batch after 2 minutes; each send times out after 30 seconds. Emails not claimed stay queued and count no try (answer Q2, BR51.1). | A test with 60 due emails and a slow fake mailer claims 50 or fewer, and the rest are queued with no try counted. |
| NFR9.6 | A daily run on the `db:seed:large` set finishes its checks in under 30 seconds, not counting mail sending. | A timing test of the run on that seed. |
| NFR9.7 | Each check's changes are undone on their own if it fails (BR52.2); a run is one call and holds its locks until it ends, so a run stays short (NFR9.6). | A test makes one check fail and finds the others kept. |

## Screens

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR8.1 | All text on new and changed screens and in emails is Hungarian, including refusal texts. | Reviewed in the screenshots and the email texts. |
| NFR8.2 | "Kézbesítési hibák" is designed in Stitch first, works at phone width and by keyboard, wraps long titles, and has no serious or critical accessibility violations. | Browser checks in all three browsers, and the owner's screenshot comparison. |
