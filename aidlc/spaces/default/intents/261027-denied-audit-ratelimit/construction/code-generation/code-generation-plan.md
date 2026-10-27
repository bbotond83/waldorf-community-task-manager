# Code Generation Plan: B3 per-account rate limit for denied-call audit events

## Summary

- Builds: a per-account limit of 20 denied audit events per sliding 60 minutes, enforced once in `platform_audit_write`
- Touches: new `supabase/migrations/20261046_audit_denied_rate_limit.sql`, new `tests/database/audit-denied-limit.test.ts`, `tests/database/migrations.test.ts`, `package.json`, `scripts/db/shuffled-tests.ts`, the B3 entry of `minor-findings-plan.md`
- Tests: 8 real-stack database tests (7 behaviour tests run in `worker_1` and `public`, 1 migration-order test)

## Context

Zero-Unit express work, brownfield. Inputs: `../../inception/requirements-analysis/requirements.md` (FR1 to FR5, NFR1 to NFR4, C1 to C5) and the code knowledge base `aidlc/spaces/default/codekb/waldorf-community-task-manager/`.

Facts the plan relies on (from the scan, re-checked in the source):
- `platform_audit_write(p_action text, p_target_type text, p_target_id uuid, p_organization_id uuid, p_group_id uuid, p_outcome text, p_details text) returns uuid` is defined once in `20261012_platform_audit.sql` (`security definer set search_path from current`, then `revoke all ... from public, anon, authenticated, service_role`).
- Denied events reach it only through `platform_finish_operation` (`20261013`), which calls it with `perform` and builds the returned result and the stored idempotency result itself.
- `platform_actor_account()` returns `platform_system_account()` (the all-zeros account) for the system caller, else `auth.uid()`.
- Index `audit_events_actor (actor_account_id, occurred_at desc)` exists; no index includes `outcome`.
- The project's per-key lock pattern: `pg_advisory_xact_lock(hashtextextended(current_schema() || '|' || ..., 0))` (`20261013`).

## Branch

The work goes on its own branch, `fix/denied-audit-rate-limit`, created from `origin/main` (02b4686) before Step 1. The pull request is opened against `main` and is never merged by the agent (C4).

## Steps

- [x] Step 1: Project structure and configuration. Confirm the branch `fix/denied-audit-rate-limit` is checked out on top of `origin/main` and that `supabase/migrations/20261045_audit_purge_isolation.sql` is the last migration file. No configuration change is needed. (C1, C4)
- [x] Step 2: Verify the test runner. Confirm `node --experimental-strip-types --test tests/database/audit.test.ts` is the runner form used by `test:database:stack` in `package.json`, and record the exact commands in `unit-test-instructions.md`. Database tests need the local stack (`npm run db:start`); if it cannot be started here, record that and leave execution to Build and Test / CI. (NFR4)
- [x] Step 3: Database behaviour, implement. Create `supabase/migrations/20261046_audit_denied_rate_limit.sql` (forward-only, schema-neutral, header comment in the style of `20261045`: names follow-up B3 / U1 R-02, the owner decision of 2026-10-27, and "Forward-only: the merged files 20261012 and 20261013 are not edited"). Contents: (FR1, FR1.1 to FR1.4, FR2 to FR5, NFR1 to NFR3, C1 to C3)
  1. An additive partial index `audit_events_actor_denied on audit_events (actor_account_id, occurred_at desc) where outcome = 'denied'` (`create index if not exists`). (NFR3)
  2. `create or replace function platform_audit_write(...)` with the identical signature and return type, `language plpgsql security definer set search_path from current`. Body:
     - `v_account := platform_actor_account();` (called once, reused for the insert).
     - When `p_outcome = 'denied'` and `v_account <> platform_system_account()`: take `pg_advisory_xact_lock(hashtextextended(current_schema() || '|audit-denied|' || v_account::text, 0))`, then count `audit_events` rows with `actor_account_id = v_account and outcome = 'denied' and occurred_at > now() - interval '60 minutes'`; when the count is 20 or more, `return null` without inserting.
     - Otherwise insert exactly as before (same columns and values, `platform_actor_role(p_organization_id)`) and return the new id.
     - The limit (20) and window (60 minutes) are named constants in the `declare` block with a comment pointing to the owner decision.
  3. Restate `revoke all on function platform_audit_write(text, text, uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;`. (NFR2)
  Callers are not changed: `platform_finish_operation` already ignores the return value (`perform`), and the seven direct callers pass `'success'`, so they never get `null`.
- [x] Step 4: Database behaviour, write and run its tests. Create `tests/database/audit-denied-limit.test.ts` following `tests/database/audit.test.ts` (loop over `["worker_1", "public"]`; `openDatabase`, `lockSchemas`, `prepareSchema` in `before`; `useSchema`, `resetWorkerData`, `seedGrants` in `beforeEach`). Denials are produced with `lifecycle_hold_place` as `PARENT` (and `OUTSIDER` for the second account) through `asActor`, each call with a distinct idempotency key; aged events are inserted directly through the owner connection as in `audit-purge.test.ts`. Tests:
  1. writes the 1st to 20th denied events of an account and not the 21st, while the 21st call still returns `denied`; replaying the 21st call's key returns `denied` again and writes nothing (FR1, FR1.2, FR2)
  2. counts a sliding 60-minute window: 20 denied events aged 61 minutes do not block a new one; 20 aged 59 minutes do (FR1.1, FR1.4)
  3. keeps accounts independent: with `PARENT` at the limit, a denial for `OUTSIDER` is written (FR1.3)
  4. limits only denied events: with the account at the limit, a success event is still written, and 20 success events in the window do not block a denied one (FR3)
  5. exempts the system account: 21 denied events written by the system caller (owner connection calling `platform_audit_write(..., 'denied', ...)`) are all stored (FR4)
  6. holds the limit under simultaneous calls: 25 concurrent denied calls for one account from separate connections store exactly 20 events (NFR1)
  7. keeps the function closed to `anon`, `authenticated` and `service_role`, and the partial index exists (NFR2, NFR3)
  Register the file in the `test:database:stack` script in `package.json` and in the list in `scripts/db/shuffled-tests.ts` (beside `tests/database/audit.test.ts`), so `verify:local` and CI run it. Run the new file and `tests/database/audit.test.ts` when the local stack is available. (NFR4)
- [x] Step 5: Migration order test. Add one test to `tests/database/migrations.test.ts` in the style of the `20261045` test: `20261046_audit_denied_rate_limit.sql` exists, sorts after `20261045_audit_purge_isolation.sql`, is tracked as applied in `public` and `worker_4`, and a second run applies nothing. (C1, C2)
- [x] Step 6: Repository, business logic, API and frontend layers: not applicable. The change is entirely inside the database; no TypeScript application code changes (requirements, Out of scope).
- [x] Step 7: Environment and build configuration: none beyond the script registration in Step 4.
- [x] Step 8: Documentation and traceability. Add a dated Done note (2026-10-27) under B3 in `aidlc/spaces/default/intents/261012-real-backend-local/follow-ups/minor-findings-plan.md`, in the style of the other Done notes: branch `fix/denied-audit-rate-limit`, intent `261027-denied-audit-ratelimit`; what changed (limit of 20 denied events per account per sliding 60 minutes in `platform_audit_write`, migration `20261046`, caller result unchanged, system account exempt, per-account lock); decisions and limits (suppressed denials are not counted anywhere; the first 20 per hour remain as evidence; the organization label is still caller-supplied within those 20). Also mark Group F decision 1 as decided (per-account rate limit, 2026-10-27). (C4)
- [x] Step 9: Static checks. Run `npm run typecheck`, `npm run lint` and `npm run format:check` (or the project's equivalents named in `package.json`) on the changed TypeScript files; fix any finding. (C5)

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:3d292c6045d13da5e4d7456ce512bed1710e7c19d4cd1fcfbb8c23797b5346c2",
  "contract_sha256": "sha256:ccfc2d241c3297baee8acc2adf0300e8dd8d3a3c089e4a5c084dd757a212e135"
}
```

## Requirement to step map

| Requirement | Steps |
|-------------|-------|
| FR1, FR1.1 to FR1.4 | 3, 4 (tests 1 to 3) |
| FR2 | 3, 4 (test 1) |
| FR3 | 3, 4 (test 4) |
| FR4 | 3, 4 (test 5) |
| FR5 | 3 |
| NFR1 | 3, 4 (test 6) |
| NFR2 | 3, 4 (test 7) |
| NFR3 | 3, 4 (test 7) |
| NFR4 | 2, 4 |
| C1, C2 | 3, 5 |
| C3 | 3 |
| C4 | Branch, 8 |
| C5 | 9 |
