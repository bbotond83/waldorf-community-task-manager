# Reliability Requirements: U2 Identity and access

Source: NFR6, NFR2 of the requirements, rules BR2.2, BR2.11, BR2.12, BR2.14, BR2.18, BR2.21.

| ID | Requirement | Check |
|---|---|---|
| NFR6.1 | U2's migrations apply cleanly on a fresh database and a second time (forward-only, as in U1), in the default schema and a worker schema | The migration repeatability test is extended to U2's files |
| NFR6.2 | Invitation acceptance is atomic: after any injected failure the invitation is back to pending, no Account or grant exists, and a retry succeeds; a leftover sign-in user never blocks a retry and is never deleted when it has an Account | Failure-injection tests at each step, including the concurrent double submit |
| NFR6.3 | Grant changes, deactivation and reactivation are atomic with their audit event and idempotent for the same key | Database tests with injected failures and repeated keys |
| NFR6.4 | When the sign-in service is unavailable, sign-in, invitation acceptance and reset return a retryable result with a Hungarian message, create no session and leave no partial state | Tests with the sign-in service stopped |
| NFR6.5 | After deactivation, the database refuses the account at once even if the ban or session removal call to the sign-in service fails; the failed call is retried and reported | A test that makes the follow-up call fail |
| NFR6.6 | The first-super-admin command leaves nothing behind when any step fails, and two simultaneous runs for the same organization cannot both succeed | Tests with injected failures and a two-process race |
| NFR6.7 | Housekeeping is safe to run at any time and repeatedly; it removes expired attempts, orphaned invitation users older than 1 hour without an Account, and ended invitations 90 days after they end (this retention extends rule BR2.21, which was reviewed before the owner's answer Q3 and is amended in code generation without changing its meaning) | Tests with a controllable clock |
| NFR6.8 | When sending the invitation email fails (the mail server is unavailable), invitation creation still stores the pending invitation, returns a retryable result that says the email was not sent, and the admin can resend it | A test with the mail server stopped |

Availability targets (SLA, SLO) do not apply: the environment is local.
