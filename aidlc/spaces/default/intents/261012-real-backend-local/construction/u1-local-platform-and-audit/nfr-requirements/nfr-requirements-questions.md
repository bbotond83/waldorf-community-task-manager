# NFR Requirements Questions: U1 Local platform and audit

U1 is local tooling plus the audit and idempotency storage. Most quality targets are about developer speed, repeatability and keeping personal data out of the repository. These questions fix the numbers.

## Q1. How fast must the local tooling be on the owner's machine, once Docker images are already downloaded?

A. Start the stack within 90 seconds, apply all migrations to the default schema within 30 seconds, create and migrate one worker schema within 10 seconds, and run the privacy and secret scans within 15 seconds.
B. Looser: start within 3 minutes, migrations within 90 seconds, worker schema within 30 seconds, scans within 60 seconds.
C. No numeric budgets; only report the timings.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. Start the stack within 90 seconds, apply all migrations to the default schema within 30 seconds, create and migrate one worker schema within 10 seconds, and run the privacy and secret scans within 15 seconds.

## Q2. How are migrations kept repeatable and how is a bad one undone?

A. Forward-only migrations: a test applies all of them to a fresh schema twice (second run is a no-op or fails clearly), and recovery locally is a reset (drop and recreate), never a down migration.
B. Every migration also ships a down migration, tested in CI.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Forward-only migrations: a test applies all of them to a fresh schema twice (second run is a no-op or fails clearly), and recovery locally is a reset (drop and recreate), never a down migration.

## Q3. What should the tooling log and report?

A. Each command prints a short step-by-step progress line and a final timing; failures name the step, file or setting; nothing prints keys, passwords or personal data; CI keeps the logs as normal job output. No dashboards or alerts.
B. Same as A, plus a machine-readable log file per run kept locally.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Each command prints a short step-by-step progress line and a final timing; failures name the step, file or setting; nothing prints keys, passwords or personal data; CI keeps the logs as normal job output. No dashboards or alerts.

## Q4. Which tools find secrets and personal data in the repository?

A. Extend the existing `scan:secrets` and `scan:privacy` scripts in the repository with the rules from the design (no new external tool), and keep them as blocking checks in CI.
B. Add a separate dedicated secret-scanning tool (for example Gitleaks) in CI in addition to the scripts.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Extend the existing `scan:secrets` and `scan:privacy` scripts in the repository with the rules from the design (no new external tool), and keep them as blocking checks in CI.

## Q5. How many parallel test workers must the isolation support?

A. Up to 4 workers at the same time (matching the current number of browser projects and a typical laptop), proved by three consecutive parallel runs without interference.
B. Up to 8 workers.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Up to 4 workers at the same time (matching the current number of browser projects and a typical laptop), proved by three consecutive parallel runs without interference.

## Consolidated Summary Confirmation

- Speed: stack start within 90 seconds, migrations within 30 seconds, one worker schema within 10 seconds, scans within 15 seconds.
- Migrations: forward-only; a test applies all to a fresh schema twice; local recovery is a reset.
- Reporting: progress lines and timing, failures name the step, nothing sensitive printed, normal CI job logs, no dashboards.
- Scanners: extend the existing secret and privacy scripts, blocking in CI.
- Workers: up to 4 in parallel, proved by three consecutive parallel runs.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
