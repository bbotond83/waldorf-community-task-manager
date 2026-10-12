# Observability Requirements: U1 Local platform and audit

Source: confirmed answer Q3 and NFR1. The unit is local tooling, so observability means readable command output and CI logs, not dashboards.

| ID | Requirement | Check |
|---|---|---|
| NFR1.11 | Every tooling command (start, stop, migrate, worker setup, scans) prints a short progress line per step and a final timing | Output test for each command |
| NFR1.12 | A failure names the step, file or setting that failed and exits with a failure status | Failure-case tests |
| NFR1.13 | No command prints keys, passwords or personal data (NFR1.8) | Output test with fake secrets |
| NFR1.14 | CI keeps the commands' output as normal job output; no log files, dashboards or alerts are added | Review of the CI workflow |
| NFR1.15 | The audit log is the record of audited changes; it is queried through the database by an admin (reading is added with the screens in later units) | Covered by the audit function tests |

No metrics, tracing or alert thresholds are defined for this unit.
