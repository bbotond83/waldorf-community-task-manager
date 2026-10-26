# Requirements: Audit purge isolation

## Intent analysis

The audit trail (`audit_events`) is append-only; rows older than 365 days may be removed only by `audit_purge()`, which the daily clean-up job `identity_housekeeping()` calls. Today that call sits in the same database transaction as the rest of the clean-up (sign-in attempt pruning, stale reservation release, orphan sign-in user removal, invitation clean-up, import expiry). If the purge fails or runs into a time limit, for example the first run against a large backlog of old rows, the whole transaction rolls back and none of the other clean-up happens. Because the next run would hit the same backlog, the failure repeats every day.

This work makes the purge unable to stop the rest of the clean-up, and bounds how much one purge call does so a backlog is worked off over several runs.

Origin: finding R-18 of the U2 review and R-08 of the U5 review; group B1 of `follow-ups/minor-findings-plan.md`.

## Functional requirements

- **FR1** A purge failure does not stop the housekeeping.
  - **FR1.1** `identity_housekeeping()` runs the purge inside its own sub-transaction (a `BEGIN ... EXCEPTION WHEN OTHERS` block). A failure of the purge undoes only the purge; every other clean-up step still commits.
  - **FR1.2** When the purge fails, the result reports `audit_events_purged` as 0 and a new field `audit_purge_failed` as `true`. When it succeeds, `audit_purge_failed` is `false`. The result carries no error text and no personal data.
  - **FR1.3** All other result fields and the success status of `identity_housekeeping()` are unchanged.
- **FR2** One purge call is bounded.
  - **FR2.1** `audit_purge()` deletes at most 5000 rows per call: the oldest aged rows first (by `occurred_at`, then `id`), selected by `id`.
  - **FR2.2** Rows beyond the cap stay in place and are removed by later calls; `audit_purge()` still returns the number of rows it deleted.
- **FR3** Nothing else about the purge changes.
  - **FR3.1** The signature of `audit_purge()` stays `() returns integer`; it stays callable by the system caller only (`service_role`), with the same privilege grants, `security definer` and `search_path`.
  - **FR3.2** The append-only trigger rule is unchanged: a delete passes only inside the purge and only for rows older than 365 days; updates and deletes of younger rows are refused.
  - **FR3.3** The 365-day purge also covers import and notification audit events (they are rows of the same table); this is recorded in the notes of this change.
- **FR4** The change is delivered as a new forward-only migration `supabase/migrations/20261045_audit_purge_isolation.sql`; merged migrations are not edited.
- **FR5** Documentation matches behaviour: the U5 notes that describe the purge as all-or-nothing, or as unbounded, are corrected.

## Non-functional requirements

- **NFR1** Safety: the privilege model of the elevated functions is unchanged; the catalogue test (`tests/database/identity-catalogue.test.ts`) passes.
- **NFR2** Privacy: the failure flag and any log line carry no row content, error text or personal data.
- **NFR3** Performance: one purge call deletes at most 5000 rows, so one run holds its row locks only briefly; a backlog is worked off by repeated daily runs.
- **NFR4** Verifiability: the new behaviour is covered by database tests on the real local stack, which CI runs.
- **NFR5** Quality gates: strict type check, lint, format check and unit tests stay green; coverage of production source stays at or above 80%.

## Constraints

- The migration applies cleanly on top of the current head (`20261044_audit_purge.sql`) and on a fresh database.
- No new dependency.
- The real-stack database tests need Docker and the local stack; they are run by CI, and locally only when the owner starts the stack.

## Assumptions

- 5000 rows per call is a reasonable cap: it is large enough to clear a normal daily volume in one run and small enough to finish quickly. It lives in one place in the function and can be changed by a later migration.
- A failing purge is injected in tests by a mechanism the existing database tests already use (for example a temporary trigger or a revoked privilege inside a test transaction); the exact mechanism is chosen in Code Generation.
- The housekeeping job runs daily, so a backlog of N rows clears in about N / 5000 days; this is acceptable because the rows are past retention, not urgent.

## Out of scope

- Raising an alert when the purge keeps failing (observability is a separate follow-up).
- Changing the 365-day retention period.
- Other follow-up findings (B2 to F); each has its own branch.

## Open questions

None.
