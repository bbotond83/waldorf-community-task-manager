# Security Requirements: U1 Local platform and audit

Source: NFR1, NFR2, NFR3, rules `BR1.3`, `BR1.4`, `BR3.4`, `BR3.9`, `BR11.1` from the functional design, and confirmed answer Q4.

| ID | Requirement | Check |
|---|---|---|
| NFR1.1 | The audit write function and the audit table are unreachable by `anon`, `authenticated` and any application role; actor and role come from the session or a verified system actor (BR3.9) | A wrong-role database test tries to call the function and to insert directly and must be refused |
| NFR1.2 | Audit events cannot be updated or deleted by any application role (BR3.4) | A database test attempts update and delete and must be refused |
| NFR1.3 | Audit details, hold reasons and idempotency records never contain personal data: code-shaped text only, a request hash instead of a request body | Tests for a matching code, a free-text name and an over-length value |
| NFR1.4 | The service-role key never reaches the app runtime or the browser; the app reads only the database address, the public key, the session secret and the schema setting (BR1.3, BR1.4) | A configuration test and a bundle scan confirm no service-role name or value appears in app code or client output |
| NFR1.5 | The session secret is at least 32 characters and differs from the example value; each environment has its own | Configuration validation test (BR1.3) |
| NFR1.6 | The secret scan (extended `scan:secrets`) fails on JWT-shaped strings, private-key headers and service-role key names with values in tracked files; it is a blocking CI check | Positive and negative test cases for the scan |
| NFR1.7 | The privacy scan (extended `scan:privacy`) fails on tracked spreadsheet or dump files and on emails and phone numbers outside the fixtures folder and the allowed-example list (BR11.1); it is a blocking CI check | Positive and negative test cases for the scan |
| NFR1.8 | Tooling output never prints keys, passwords or personal data | A test runs each command against fake secrets and checks the output |
| NFR1.9 | Idempotency records are readable and writable only by the operation's database function, for the owning account | A database test with a second account must be refused |
| NFR1.10 | Seed and test credentials exist only in local and test environments (enforced by the seed's local-only guard in U5) | Verified in U5; U1 only keeps them out of tracked files via NFR1.6 |

Threat considerations: forged audit events (NFR1.1), tampering with the audit log (NFR1.2), leaking secrets through the repository (NFR1.6) or the browser bundle (NFR1.4), leaking personal data through the audit log or scans' output (NFR1.3, NFR1.8).
