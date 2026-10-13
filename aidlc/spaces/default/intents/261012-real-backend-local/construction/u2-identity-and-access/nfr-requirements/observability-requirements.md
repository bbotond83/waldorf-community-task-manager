# Observability Requirements: U2 Identity and access

Source: confirmed answer Q2 and NFR1. Observability here means structured server output and the audit log, not dashboards.

| ID | Requirement | Check |
|---|---|---|
| NFR1.17 | The server writes one structured line per security event with an event code and a timestamp: sign-in success, sign-in failure, lockout, invitation created, accepted and expired, reset requested and used, grant change, deactivation and reactivation; the expired event is written when someone opens an expired link and by housekeeping for invitations that reach their expiry | A test asserts the line and its emitter for each event |
| NFR1.18 | Each line carries a keyed hash of the account and never the email, password, token, link or session value | A test with fake secrets scans every line produced by the identity tests |
| NFR1.19 | The audit log (U1) is the record of grant changes, deactivation, reactivation, invitation acceptance and the first super admin; its details text stays code-shaped | Covered by the unit's audit tests |
| NFR1.20 | Failures name the step, never the secret: each server action and command reports a failing step and a Hungarian message to the person | Failure-case tests |
| NFR1.21 | The structured lines are normal server output; no files, dashboards, alerts or tracing are added | Review of the change |

No alert thresholds are defined; the environment is local.
