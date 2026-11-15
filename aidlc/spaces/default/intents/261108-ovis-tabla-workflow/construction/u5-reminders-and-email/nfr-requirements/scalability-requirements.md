# Scalability Requirements: u5-reminders-and-email

Sources: NFR5 and NFR9 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and C1 and C9 in `contract-summary.md`. Stack limits are in `technology-stack.md`.

## Load Projection

One community of about 20 families, so roughly 40 parents. A rota publishing notice or a reminder may queue 40 emails at once; a school year brings a few thousand notices and emails in all. Run, check and email records are pruned after 30 and 90 days (NFR1.5), so the tables stay in the low thousands of rows. No scaling mechanism is needed.

## Concurrency Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR5.1 | Two delivery passes at once claim different emails, and no email is taken twice; a claim never waits (BR51.1). | A two-at-once test with 20 due emails finds each claimed once. |
| NFR5.2 | Recording an outcome twice, or for a try that is not the claimed one, changes nothing (BR51.5). | A repeated-click test compares the status and counts. |
| NFR5.3 | A call to `notice_send` repeated, or two runs overlapping, create one notice and one email per parent and once key (BR50.2, BR52.5). | Repeated and two-at-once tests count notices and emails. |
| NFR5.4 | The duty-reminder check locks its jobs by ascending id and sends each job once when two checks overlap (BR53.3). | A two-at-once test finds one notice per parent and job. |
| NFR5.5 | Two super admins pressing Try again on one group start one new round; the second gets REMINDER_NOT_RETRYABLE (BR54.4). A repeated key returns the stored result. | A two-at-once test and a repeated-click test. |
| NFR5.6 | Try again sends back the group key (kind, item type, item id) and the list of (delivery id, try count) the screen showed. Under the ascending-id lock the call is refused with REMINDER_STALE when any listed email is no longer failed or its try count differs; otherwise it restarts exactly the listed emails. A failure that joined the group later is not listed, stays failed and appears on the next view (BR54.3, aligned in this stage). | Three tests: a retry after a listed email got a new try (refused), a retry after a new failure joined (listed ones restart, the new one stays failed), and a plain retry. |
| NFR5.7 | Lock order stays family row, task rows ascending, assignment rows ascending; the new functions add delivery rows ascending and no cycle (C1). | The race tests pass repeatedly with no deadlock. |

The service-role claim has no "outdated screen" case, and the run has no "repeated click"; the test plan records why.
