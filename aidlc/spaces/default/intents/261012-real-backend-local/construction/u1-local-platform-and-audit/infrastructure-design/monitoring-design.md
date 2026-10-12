# Monitoring Design: U1 Local platform and audit

The unit is local tooling, so monitoring means command output and CI job results. There are no dashboards, alerts or on-call routes. Source: NFR requirements (observability and performance) and answer Q3 of the NFR questions.

## Metrics and KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Stack start time | start command's final timing | 90 seconds (NFR4.1) | Keeps the daily start usable |
| Migration time, default schema | migration command's timing | 30 seconds (NFR4.2) | Keeps resets fast |
| Worker schema creation time | worker setup timing | 10 seconds (NFR4.3) | Keeps test setup cheap |
| Scan time | scan scripts' timing | 15 seconds (NFR4.4) | Keeps the scans in every run |
| Audit overhead | database test | 50 ms added per operation (NFR4.5) | Audit must not slow screens |

Thresholds are reported, not enforced as failures (see `performance-requirements.md`).

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI check failed | Any required check fails (type check, lint, format, tests, build, scans, dependency audit) | Blocking | GitHub pull-request checks (blocks the merge) |
| Docker unavailable or port in use | Start command fails fast with a message (NFR6.6) | Blocking locally | The terminal of the person running it |

## SLIs / SLOs

None. The environment is local; no availability objective applies.

## Logs and Tracing

Each command prints a progress line per step and a final timing; failures name the step, file or setting; nothing sensitive is printed (NFR1.11 to NFR1.13). CI keeps the output as normal job output. No log files, aggregation, tracing or dashboards are added.
