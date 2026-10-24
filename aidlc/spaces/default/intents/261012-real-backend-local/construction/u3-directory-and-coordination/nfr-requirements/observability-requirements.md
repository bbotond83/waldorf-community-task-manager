# Observability Requirements: U3 Directory, settings and coordination

Source: NFR1 and the structured-output rules of U2 (NFR1.17 to NFR1.21). Observability here means structured server output and the audit log, not dashboards.

| ID | Requirement | Check |
|---|---|---|
| NFR1.38 | Expected failures are result codes, not log noise; unexpected failures are logged once at the adapter boundary with an event code (database error, timeout, deadlock) and the use case name | Tests with injected errors read the produced lines |
| NFR1.39 | Log lines carry a keyed hash of the account and never names, contacts, notes, tokens or ids of other people | An output scan with fake personal data (as NFR1.35) |
| NFR1.40 | The audit log records approvals (`approval.approve`, `approval.reject`) and lifecycle actions (`lifecycle.anonymize`, `lifecycle.delete`) in the same transaction as the change (U1 BR3.2); no other U3 action is audited | Audit tests per decision and per lifecycle path, and a test that other actions write no audit row |
| NFR1.41 | Each server action reports a failing step and a Hungarian message to the person, never a database message | Failure-case tests for the new and changed actions |
| NFR1.42 | No files, dashboards, alerts or tracing are added | Review of the change |

No alert thresholds are defined; the environment is local.
