# Monitoring Design: u5-reminders-and-email

The app runs only on the owner's computer, so there is no metrics platform, alerting service or SLO. Monitoring here is the run records, the super admin's failure screen, the timed command's output and event lines, as set in `nfr-design/observability-design.md`.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Notice list and failure screen load time | Timing tests on `db:seed:large` | Under 2 s | NFR9.1 |
| Daily run duration | Timing test, not counting mail | Under 30 s | NFR9.6 |
| Emails claimed per pass | Command summary line | At most 50 | NFR9.5 |
| Failed checks and failed emails per run | Run records, command summary and exit code | 0 expected | NFR4.2, NFR4.5 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| A check failed or is missing | Check record outcome failed or missing; command exits non-zero | Warning | Command output and the "Kézbesítési hibák" screen |
| Email failed after 3 tries | Delivery status failed | Warning | The "Kézbesítési hibák" screen; command exit code |
| Mail send failed | Event line `notice_mail_failed` (opaque ids, reason class) | Info | Server log |
| Claim expired | Try recorded with reason `claim_expired` | Info | The try record; counted in the summary line |

## SLIs / SLOs

None: nothing is hosted and no delivery time is promised. The 15-minute pass and 3 tries per round are behaviour, not targets.

## Logs & Tracing

Event lines and the command's summary lines carry counts, kinds, opaque ids and reason classes only, never an address, name or error text from the mail server (NFR1.4, NFR7.11). No tracing. No dashboard; the failure screen is the view, designed in Stitch.
