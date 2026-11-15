# Observability Requirements: u5-reminders-and-email

Sources: NFR4 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, C8 and C9 in `contract-summary.md`, and `technology-stack.md`. The app runs only on the owner's computer, so no monitoring, alerting or SLO applies yet; the run records and the super admin's screen are the observation surface.

## Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.2 | Every run writes one run record and one record per check, with the run kind, Budapest moment, outcome (success, failed or missing) and database error code; records are never changed (BR52.2). | A test runs a good, a failing and a missing check and reads the records. |
| NFR4.3 | The delivery-problems screen shows failed emails and the failed or missing check records of the last 30 days, and shows a clear empty state only when the read succeeded; a failed read shows the existing error state, never an empty list. | A browser or component test covers each state. |
| NFR4.4 | Every email try is recorded with its round, try number, outcome and reason class (for example sent, rejected, unavailable, claim_expired), and never an address, text or mail server reply (BR51.2). | A test reads the tries after each outcome. |
| NFR4.5 | The timed command prints one summary line per run and per pass (kind, moment, checks run, failed, emails sent, retry, failed) with counts only, and exits non-zero when a check failed or any email failed. | A command test reads the line and exit code for a good and a failing run. |
| NFR4.6 | A failed send emits one event line with opaque ids and an error class, as `invitation_mail_failed` does today (NFR1.4). | A test fails the mailer and reads the line. |
| NFR4.7 | A refusal names its code in the result envelope (NOTICE_KIND_UNKNOWN, NOTICE_TARGET_UNKNOWN, NOTICE_REQUEST_INVALID, run_kind_invalid, REMINDER_NOT_RETRYABLE, REMINDER_STALE, authorization_denied) so the screen can explain it and tests can assert it. | Each code has a test that asserts it. |
| NFR4.8 | No new audit action is added; the run and check records are the record of daily runs, kept 30 days (NFR1.5). The existing audit log is untouched by this Unit. | The audit action check constraint test passes unchanged. |
| NFR4.9 | A later unit sees from the registries which kinds, target types and checks exist, and a check that is registered but not found shows as missing in the first run after it is added. | A test registers a check without a function and reads its record. |
