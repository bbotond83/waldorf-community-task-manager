# Performance Requirements: U1 Local platform and audit

Targets for the local tooling on the owner's machine, with Docker images already downloaded. Source: confirmed answers Q1 and Q5 in `nfr-requirements-questions.md`, NFR4 of the requirements.

| ID | Requirement | Target | Check |
|---|---|---|---|
| NFR4.1 | Start the local stack (database, sign-in service, mail catcher) until all are healthy | 90 seconds or less | The start command prints its final timing; the check compares it with the target |
| NFR4.2 | Apply all migrations to the default schema | 30 seconds or less | Timing printed by the migration command |
| NFR4.3 | Create and migrate one worker schema | 10 seconds or less | Timing printed by the worker setup |
| NFR4.4 | Run the privacy scan and the secret scan | 15 seconds or less together | Timing printed by the scripts |
| NFR4.5 | Audit write and idempotency lookup add no visible delay to an operation | Under 50 ms added per operation on the local database | A database test measures one audited change against the same change without the audit write |

Targets are reported, not enforced by failing a merge on a slow machine: a missed target is shown in the run output and in the unit checkpoint report. Seed time (60 seconds) and reset time (30 seconds) belong to U5.
