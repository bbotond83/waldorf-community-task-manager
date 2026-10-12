# Scalability Requirements: U1 Local platform and audit

This unit is local tooling and small storage tables; there is no user-facing load. Source: NFR3 and confirmed answer Q5.

| ID | Requirement | Check |
|---|---|---|
| NFR3.1 | The worker isolation supports up to 4 test workers at the same time, each with its own schema and account prefix | Three consecutive parallel runs of the database-backed tests with 4 workers, no interference |
| NFR3.2 | Worker names are limited to lowercase letters, digits and underscores, so any number of workers up to the limit can be created without name clashes | A unit test for the name check |
| NFR3.3 | Audit and idempotency tables are indexed on the columns the app queries (actor, target, time; account, operation, key, expiry) so lookups stay fast at the volume of the 30-family seed (a few thousand rows) | A database test checks the indexes exist |
| NFR3.4 | The tests are independent of each other and of run order | Tests are run in random order once in CI |

Capacity planning beyond a few thousand audit rows is out of scope for the local environment.
