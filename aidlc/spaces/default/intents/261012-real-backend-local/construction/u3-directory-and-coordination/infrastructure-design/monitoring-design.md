# Monitoring Design: U3 Directory, settings and coordination

Local environment: monitoring means structured server output and test timings; no dashboards, alerts or tracing. Source: the observability and performance requirements.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Task list, detail, admin list and schedule time | Database timing tests on the 150-family data set | 300 ms typical, reported; 1500 ms fails (NFR4.6) | Screens must stay responsive |
| Parent task list page render time | One browser timing check on the 150-family data set | Reported only (NFR4.6) | Shows what the person feels |
| Action time (sign-up, swap, decision, save) | Timing lines in database tests | 500 ms typical, reported; 1500 ms fails (NFR4.7) | Parents wait for these |
| Dashboard and lifecycle list time | Timing lines | 500 ms typical, reported; 1500 ms fails (NFR4.8) | Admin screens |
| U2 access-check overhead after the rewrite | U2's timing test, re-run | 50 ms target, 200 ms fails (NFR4.9) | Runs on every request |
| Race outcome | The 20-parallel sign-up test | Exactly 5 places taken, no duplicate (NFR3.7) | Capacity is shared |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI check failed | Any required check fails | Blocking | GitHub pull-request checks |
| Database error at the boundary | An unexpected database error in a use case | Logged once with an event code | Server output; the person sees a retryable or terminal message (NFR1.38) |

## SLIs / SLOs

None. The environment is local.

## Logs and Tracing

Expected failures are result codes. Unexpected failures are logged once at the adapter boundary with an event code and the use case name, a keyed hash of the account and no names, contacts, notes or tokens (NFR1.38, NFR1.39). The audit log records approval decisions and lifecycle actions only (NFR1.40). No files, aggregation or dashboards.
