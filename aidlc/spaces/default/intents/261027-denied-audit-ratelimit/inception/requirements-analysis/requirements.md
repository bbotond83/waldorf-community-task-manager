# Requirements: B3 per-account rate limit for denied-call audit events

## Intent analysis

Finding B3 (U1 R-02, `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`): a signed-in user can append unlimited denied audit events, labelled with any organization, by calling functions such as `lifecycle_hold_place`. The audit log is append-only, so these rows stay until the 365-day purge. The owner chose the per-account rate limit (Group F, decision 1) on 2026-10-27 [desc]. The goal is to bound how much one account can grow the audit log through denied calls, without changing what any caller sees.

- **Type**: enhancement to an existing security control, database layer only
- **Scope**: one component (the shared platform audit write), plus tests and a documentation note
- **Complexity**: simple

## Functional requirements

- **FR1 Denied-event cap.** Before writing an audit event whose outcome is `denied`, the system shall count that account's `denied` events written in the last 60 minutes. If 20 or more already exist, it shall not write the new event. [desc] [Q1] [Q2]
  - **FR1.1** The window is a sliding 60 minutes ending at the moment of the write, not a clock hour. [Q1]
  - **FR1.2** The limit is exactly 20: the 1st to 20th denied events in any 60-minute window are written; the 21st and later are not. [Q2]
  - **FR1.3** The count is per account (`actor_account_id`). One account reaching the limit does not affect any other account. [desc]
  - **FR1.4** Once older denied events fall out of the 60-minute window, new denied events for that account are written again, up to the limit.
- **FR2 Caller result unchanged.** A call that is denied returns the same `denied` result whether or not its audit event was written, and replaying the same request returns the same result as before. [desc]
- **FR3 Only denied events are limited.** Audit events with any other outcome (for example `success`) are always written and are not counted towards the limit. [desc]
- **FR4 System account exempt.** Denied events recorded under the built-in system account (the fixed all-zeros account used for admin and service connections without a signed-in user) are always written and are not limited. [Q3]
- **FR5 Single change point.** The limit is enforced once, inside the shared platform audit write (`platform_audit_write`), so every existing and future function that records a denied event gets it without its own code. [desc]

## Non-functional requirements

- **NFR1 Exact under concurrency.** When several calls for the same account are denied at the same moment, no more than 20 denied events are written for that account in any 60-minute window. The count and the write are serialized per account with a transaction-scoped lock, following the project's existing pattern for duplicate-request detection. Calls for different accounts must not wait for each other. [Q4]
- **NFR2 Security unchanged.** The audit write keeps its current privileges: it runs with the owner's rights, with a fixed search path taken from the current schema, and stays not callable by `public`, `anon`, `authenticated` or `service_role`. [desc]
- **NFR3 Bounded cost.** The count must be served by an index on the account and time (an existing index, or a new additive one limited to denied events), so its cost does not grow with the total size of the audit log.
- **NFR4 Verified on the real stack.** The behaviour in FR1 to FR4 and NFR1 is verified by database tests in `tests/database` that run against the local Supabase stack (never a mock), in both the `worker_1` and `public` schemas, and that are registered so local verification and CI run them. [desc]

## Constraints

- **C1 Forward-only migration.** The change ships as one new migration file after `20261045_audit_purge_isolation.sql` (expected name `20261046_<name>.sql`). Merged migration files are never edited; the migration runner refuses any applied file whose content changed. [desc]
- **C2 Schema-neutral SQL.** The migration must not hard-code a schema name, because the runner applies it to `public` and to each worker schema.
- **C3 Same function signature.** The audit write keeps its current inputs and return type, so its seven direct callers and `platform_finish_operation` keep working unchanged.
- **C4 Delivery.** A dated Done note for B3 is added to `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`. The work goes on its own branch from `origin/main` and its own pull request, which is never merged by the agent. [desc]
- **C5 Team checks.** The change passes the team's blocking checks: type check, lint, tests (including the database suites), coverage floor, production build and the security scans.

## Assumptions

- **A1** [assumption] "Account" means the actor account recorded on the event (`actor_account_id`, from `platform_actor_account()`), which is the signed-in user, or the system account for admin and service connections.
- **A2** [assumption] Several denials in one transaction share one timestamp (the transaction start). They still count individually towards the limit.
- **A3** [assumption] No existing database test produces 20 or more denials for one account within a single test. The scan found none; running the full database suites confirms it.
- **A4** [assumption] Admins seeing fewer denied events for an abusive account is the intended effect, not a defect: the first 20 per hour remain visible as evidence.

## Out of scope

- Requiring the organization on a denied event to exist, or storing denied events for unknown organizations under a fixed scope (the two alternatives the owner did not choose).
- Counting or reporting how many denied events were not written.
- Any change to application (TypeScript) code, screens or messages.
- Changing the 365-day audit purge.

## Open questions

None.

## Sources

- [desc] Initial description: the owner's request of 2026-10-27, recorded in `project-description.json`.
- [Q1] to [Q4]: `requirements-analysis-questions.md` in this folder.
- Code facts: the code knowledge base in `aidlc/spaces/default/codekb/waldorf-community-task-manager/` and the scan handoff `../reverse-engineering/developer-scan.md`.
