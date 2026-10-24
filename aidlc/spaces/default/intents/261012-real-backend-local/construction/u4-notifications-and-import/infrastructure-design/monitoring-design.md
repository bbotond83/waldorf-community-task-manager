# Monitoring Design: U4 Notifications and Excel import

Local environment: monitoring means structured server output and test timings; no dashboards, alerts or tracing. Source: the observability and performance requirements.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Import preview time (2000 rows) | Timing line in the import test and one browser check | 10 s typical, reported; 60 s fails (NFR4.10) | The admin waits on the upload |
| Import commit time (2000 rows) | Timing line | 15 s typical, reported; 60 s fails (NFR4.11) | The commit holds locks |
| Maximum workbook and zip-bomb handling | Timing line and hostile-file tests | 60 s fails (NFR4.16) | A hostile file must not hold the server |
| Notification list, mark read, reminders list, import status | Timing lines | 300 ms typical, reported; 1500 ms fails (NFR4.12) | Parent and admin screens |
| Lazy reminder tick on 600 due jobs | Timing line | 2 s typical, reported; 10 s fails (NFR4.13) | Runs when screens open |
| U3 use-case timings with notification writes | U3's timing test re-run | 500 ms typical, 1500 ms fails (NFR4.14) | Notices are written inside them |
| U2 access-check overhead | U2's timing test re-run | 200 ms fails (NFR4.15) | Runs on every request |
| Race outcomes | Two-connection tests | One notice per cause, one attempt per due job, one open run per admin (NFR3.14) | Correctness under concurrency |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI check failed | Any required check fails | Blocking | GitHub pull-request checks |
| Unexpected database or parser error | An unexpected error in a use case or the parser | Logged once with an event code | Server output; the person sees a retryable or terminal Hungarian message (NFR1.58, NFR1.61) |

## SLIs / SLOs

None. The environment is local.

## Logs and Tracing

Expected failures are result codes. Unexpected failures are logged once at the adapter boundary with an event code and the use case name, a keyed hash of the account and no names, contacts, file names or file contents (NFR1.58, NFR1.59). The audit log records the import commit only, with the run id and counts (NFR1.60). The reminders screen is the operational view of simulated delivery (NFR1.62). No files, aggregation or dashboards.
