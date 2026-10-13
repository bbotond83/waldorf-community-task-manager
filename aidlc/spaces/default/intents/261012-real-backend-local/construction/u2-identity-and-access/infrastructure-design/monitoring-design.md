# Monitoring Design: U2 Identity and access

Local environment: monitoring means structured server output and test timings; no dashboards, alerts or tracing. Source: the observability and performance requirements and the NFR answers.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Sign-in time | The extended login-time test | 5000 ms fails; about 2 s typical, reported (NFR4.1) | Keeps sign-in usable |
| Session and access check overhead | Database timing test | 50 ms target, 200 ms fails (NFR4.2) | The checks run on every request |
| Invitation function timings | Timing lines in database tests | 500 ms reported (NFR4.3) | Keeps acceptance responsive |
| Scope probe overhead | Timing line | 50 ms reported (NFR4.4) | Detail screens call it |
| Housekeeping time at 300 accounts | Timing line | 5 s reported (NFR4.5) | Seed and reset run it |
| Wrong-password count per address | The lockout table | Lock at 5 in 15 minutes (BR2.3) | Protects the sign-in screen |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI check failed | Any required check fails, including the configuration read-back, privilege and catalogue tests | Blocking | GitHub pull-request checks |
| Mail server unreachable | Invitation create cannot send (NFR6.8) | Warning to the admin | The admin sees "email not sent, resend" |

## SLIs / SLOs

None. The environment is local.

## Logs and Tracing

One structured line per security event (sign-in success and failure, lockout, invitation created, accepted and expired, reset requested and used, grant change, deactivation and reactivation) with an event code, a timestamp and a keyed hash of the account; never the email, password, token, link or session value (NFR1.17, NFR1.18). Lines are normal server output; CI keeps them as job output. No files, aggregation or dashboards.
