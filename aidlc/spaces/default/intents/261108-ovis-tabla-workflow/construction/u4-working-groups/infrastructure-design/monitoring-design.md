# Monitoring Design: u4-working-groups

The app runs only on the owner's computer, so there is no metrics platform, alerting service or SLO. For this Unit, monitoring means the audit rows, the result codes and U5's failures screen, as set in `nfr-design/observability-design.md`.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Group page load time | Timing tests on `db:seed:large` | Under 2 s | NFR9.8, NFR9.9 |
| Command time (join, leave, appoint, revoke) | Database timing test | Under 2 s | NFR9.10 |
| Deadlock errors in the race tests | The four 50-run race tests | 0 | NFR5.12 |
| Coordinator rights without a membership | Invariant check after every writer's tests | 0 | NFR7.15 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| A coordinator email failed after 3 tries | U5 delivery status failed | Warning | The "Kézbesítési hibák" screen (U5) |
| A command was refused | A result envelope with its code | Info | The screen's Hungarian message; no log line |

## SLIs / SLOs

None. Nothing is hosted.

## Logs & Tracing

- **Audit.** The audit log records `role.grant` and `role.revoke` with the reason (`revoked`, `left_group` or `removed`), using opaque ids only.
- **Join and leave.** These write no audit row. The membership row keeps when the parent joined, when they left, and why.
- **Not added.** There is no tracing and no dashboard.
