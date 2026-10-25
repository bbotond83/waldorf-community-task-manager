# Infrastructure Design Questions: U5 Seed and test migration

The requirements are approved by review. One point needs your decision (the review of the requirements raised it). The rest are listed as assumptions at the end.

## Q1. [Tester] Which database schemas do the browser tests use?

The local stack serves four test schemas, `worker_1` to `worker_4` (the data service is told their names in `supabase/config.toml`). The three browsers need three of them. The database tests also use these schemas, so the earlier requirement that a browser never shares a schema with a database test needs a rule.

A. Reuse `worker_1` to `worker_3` for the three browsers and run the database tests and the browser tests one phase after the other, never at the same time; each phase resets the schemas it uses. Nothing new to build; the requirement is read as "never at the same time".
B. Add three more schemas (`browser_1` to `browser_3`) so a browser never shares a schema with a database test, even over time. Needs a change to the stack settings and the worker setup, and every migration is then applied to three more schemas (a slower start).
X. Other (please specify)

[Answer]: A. Reuse `worker_1` to `worker_3` for the three browsers and run the database tests and the browser tests one phase after the other, never at the same time; each phase resets the schemas it uses.

## Assumptions (no answer needed; tell me if one is wrong)

1. No hosted infrastructure is created and no deployment workflow is added. The local stack of U1 is reused; nothing new is deployed.
2. New commands in `package.json`, each a script in `scripts/db/` like `start` and `worker`: `db:seed` (the small set), `db:seed:large` (the 30-family set) and `db:reset` (empties the application schema and removes the seeded accounts; a following `db:seed` rebuilds the data). Test schemas keep using `db:worker -- <name> --reset`.
3. The seed's data and the test passwords live in one tracked data module under `scripts/db/seed/`; all text is fictitious and uses example domains.
4. The audit purge (365 days) is called by the existing housekeeping function only; the seed and reset commands do not call it (they never hold old audit events). This narrows the wording of the requirement, which also named the seed and reset.
5. The sign-in timing check (5000 ms) becomes a new test of the real sign-in on seeded data. The two profile-picker timing specs that are switched off today are deleted with the picker.
6. CI: the synthetic-mode settings are removed from the workflow; the database tests and the browser tests run one phase after the other. The job time limit of 45 minutes is raised to 90 minutes once the first full run shows the need; the timing limits stay as defined, with one documented factor in the workflow for a slower runner if the first run needs it.
7. Monitoring is local: seed, reset and the timing tests print one result line each with the duration (as `db:worker` does today); unexpected failures are logged once with an event code and no personal data.
8. Secrets: the stack's keys are read from the ignored settings files that `db:start` writes; the seed passwords are fictitious and tracked; the session secret is generated per run.

## Consolidated Summary Confirmation

- Browser schemas: the three browsers use `worker_1` to `worker_3`; database tests and browser tests run in separate phases, never at the same time.
- The eight assumptions stand: no hosted infrastructure, commands `db:seed`, `db:seed:large`, `db:reset`, seed data in one tracked module, audit purge called by housekeeping only, a new sign-in timing test, CI phases and a documented timing factor, local result lines, secrets as before.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
