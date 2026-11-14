# Monitoring Design: u3-directory-and-profile

The app runs only on the owner's computer, so there is no metrics platform, alerting or SLO. Monitoring here means audit rows, event lines and screen states, as set in `observability-design.md`.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Directory, "Fiókom", records load time | Timing tests on `db:seed:large` | Under 2 s | NFR9.1 |
| Audit rows per new command | Database tests | Exactly 1 per change, 0 for a repeat | NFR4.1, NFR4.3 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Password change audit failed | Event line `password_change_audit_failed` | Warning | Server log, owner reads it |
| Other sessions not ended | Event line `sessions_end_failed` | Warning | Server log |
| Email-change mail failed | Event line `email_change_mail_failed` | Warning | Server log |
| Invitation mail failed | Existing event line `invitation_mail_failed` | Warning | Server log |
| Resend limit hit | Event line `email_rate_limited` | Info | Server log |

## SLIs / SLOs

None: nothing is hosted and no availability is promised.

## Logs & Tracing

Event lines carry keyed hashes and reason codes only, never an address or a name (NFR4.7, NFR4.8). No tracing. No dashboard; the audit log is read through the existing screens.
