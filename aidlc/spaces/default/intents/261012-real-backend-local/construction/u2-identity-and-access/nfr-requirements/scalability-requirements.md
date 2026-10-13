# Scalability Requirements: U2 Identity and access

Source: confirmed answer Q5 and NFR3 of the requirements.

| ID | Requirement | Check |
|---|---|---|
| NFR3.1 | The unit handles up to 300 accounts and 50 signed-in sessions at the same time without tuning | A database test with 300 accounts and 50 simultaneous requests through the named functions; timings reported against NFR4.2 |
| NFR3.2 | The tables the access checks read have the indexes they need: grants by subject and by scope, invitations by token hash, by email and by status, accounts by email and organization, attempts by email hash and time | A catalogue test lists the indexes by name |
| NFR3.3 | Tests are independent of each other and of run order; each worker has its own schema and account prefix (U1) and creates the accounts and invitations it needs | A shuffled-order run is kept in the unit's checks |
| NFR3.4 | Up to 4 parallel workers run the identity tests without interference | Three consecutive parallel runs, as in U1 |

Load beyond 300 accounts is out of scope; no load test is added beyond NFR3.1's local check.
