# Observability Design: u5-reminders-and-email

Sources: `nfr-requirements/observability-requirements.md`, `rules.md`, C9. The owner's computer is the only environment; the run records, the super admin's screen and the command's output are the observation surface. No metrics system, tracing or alerting is added.

## Records (NFR4.2, NFR4.4)

- **Run and check records:** one run row (kind, Budapest moment) and one row per check (check name, outcome success, failed or missing, created and skipped counts, database error code); a missing function is recorded as missing, a deliberate refinement of C9's "failed", noted in the contract in this pull request, written once, never changed, kept 30 days.
- **Email tries:** one row per try (round, try number, outcome, reason class), no address, text or server reply, kept with the delivery for 90 days.

## Screen (NFR4.3, NFR4.7)

"Kézbesítési hibák" shows failed-email groups and the failed or missing checks of the last 30 days. An empty state is shown only when the read succeeded; a failed read shows the existing error state. Refusal codes in the result envelope are mapped to Hungarian texts by the existing translation table.

## Command output (NFR4.5, NFR4.6)

The timed command prints one counts-only summary line per run and per pass and exits non-zero when a check failed or an email reached failed. A failed send emits one structured event line `notice_mail_failed` with opaque ids and the reason class, in the style of `invitation_mail_failed`.

## Audit and registries (NFR4.1, NFR4.8, NFR4.9)

No audit action is added; Try again writes none. A registered check without a function shows as missing in the first run after it is added, so a later unit that forgets its function is visible at once.
