# Reliability Requirements: U3 Directory, settings and coordination

Source: NFR6 and NFR2 of the requirements, rules BR30.2, BR30.7, BR31.4, BR31.5, BR31.10, BR32.3, BR32.4 and BR35.2.

| ID | Requirement | Check |
|---|---|---|
| NFR6.9 | U3's migrations apply cleanly on a fresh database and a second time (forward-only), in the default schema and a worker schema; the rewrite of U2's functions and the drop of the placeholder tables happen in new migration files, never by editing merged ones | The migration repeatability test is extended to U3's files |
| NFR6.10 | Every use case is one transaction: after any injected failure nothing of it is stored; this covers family archive, the swap exchange, the invitation link for a parent, and the lifecycle | Failure-injection tests per use case |
| NFR6.11 | Repeating a call with the same idempotency key returns the stored result and changes nothing more (U1 BR3.6) | Repeated-key tests for sign-up, swap, decision, archive and save |
| NFR6.12 | A stale version never overwrites a newer change: sign-up, swap, cancellation, task, record, settings and event notes return the stored codes (BR32.8) | A stale-version test for each operation |
| NFR6.13 | The database unreachable, a timeout or a deadlock maps to the retryable failure, anything unknown to the terminal failure, and no database text reaches a screen (BR32.4) | Tests with an injected database error at the adapter boundary |
| NFR6.14 | Placeholder-table removal is safe: the catalogue check runs first and the drop is skipped when anything still names them (entities.md) | The catalogue test, with a deliberate user to prove the skip |
| NFR6.15 | Until U4, the parent notification page renders without dead links for a real parent (BR32.9) | A browser test for a real parent |
| NFR6.16 | The list of use cases that U4 must connect to notifications is kept in code and tested (BR31.10) | The unit test of the exported list |

Availability targets (SLA, SLO) do not apply: the environment is local.
