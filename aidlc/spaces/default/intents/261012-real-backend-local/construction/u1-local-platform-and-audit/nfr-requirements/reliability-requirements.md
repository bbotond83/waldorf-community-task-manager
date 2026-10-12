# Reliability Requirements: U1 Local platform and audit

Source: NFR6, NFR2, rules `BR1.2`, `BR3.3`, `BR3.6`, `BR3.7`, and confirmed answer Q2.

| ID | Requirement | Check |
|---|---|---|
| NFR6.1 | Migrations are forward-only. A test applies all migrations to a fresh schema, then applies them again; the second run is a no-op or fails with a clear message and changes nothing | Migration repeatability test |
| NFR6.2 | Every migration applies cleanly to a fresh database with no manual step, including the fixed first migration | Test on an empty database in CI and locally |
| NFR6.3 | Local recovery from a bad migration or state is a reset (drop and recreate the schema or the stack's data), never a down migration | Documented in the README (U5) and exercised by the reset command (U5) |
| NFR6.4 | An audited change and its event are atomic: a thrown error saves neither (BR3.3) | A database test injects a failure after the change and checks nothing was saved |
| NFR6.5 | A repeated submission with the same key never creates a duplicate, even when two requests arrive at the same time | A concurrency database test with two simultaneous calls |
| NFR6.6 | The start command fails fast with a clear message when Docker is not available or a port is in use | Test for both messages |
| NFR6.7 | The data API configuration reload after a worker schema is created is confirmed before the first request (BR10.3) | Worker setup test that queries the new schema through the data API |

Availability targets (SLA, SLO) do not apply: the environment is local.
