# Observability Requirements: U4 Notifications and Excel import

Source: NFR1 and the structured-output rules of U2 and U3. Observability here means structured server output and the audit log, not dashboards.

| ID | Requirement | Check |
|---|---|---|
| NFR1.58 | Expected failures are result codes, not log noise; unexpected failures are logged once at the adapter boundary with an event code (database error, timeout, deadlock, parser failure) and the use case name | Tests with injected errors read the produced lines |
| NFR1.59 | Log lines carry a keyed hash of the account and never names, contacts, notes, file contents, tokens or ids of other people; the workbook file name is not logged | An output scan with fake personal data |
| NFR1.60 | The audit log records the import commit (`import.commit`, with the run id and counts only) in the same transaction as the commit; no other U4 action is audited (U1 BR3.2) | An audit test per commit and recovery path and a test that other U4 actions write no audit row |
| NFR1.61 | Each server action reports a failing step and a Hungarian message to the person, never a database or parser message | Failure-case tests for the new and changed actions |
| NFR1.62 | The reminders screen shows simulated delivery status, attempt count and correlation id (no person id), which is the operational view of reminders; no files, dashboards, alerts or tracing are added | Screen test and review of the change |

No alert thresholds are defined; the environment is local.
