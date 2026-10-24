# Code Summary: U3 Directory, settings and coordination

Unit `u3-directory-and-coordination`, intent `261012-real-backend-local`. All 33 plan steps are built (test-after, layer by layer; steps 1 to 30 in earlier batches, steps 31 to 33 in this one). Everything that touches Postgres, row-level security, the sign-in service or the mail catcher ran against the real local stack (Supabase CLI stack: Postgres 17, GoTrue v2.197.0). Test counts below come from the final run of this batch; where an earlier summary says otherwise, the executable result wins.

## What was built

| Part | What | Main files |
|---|---|---|
| A. Directory and settings (database) | Tables for organizations, school years, groups, families, group memberships, parents, contacts, children and the two settings tables, with row-level policies per role; write functions for families (with parents, contacts, children and memberships in one call), structure, archive and restore, settings, and the optional profile (read only through `directory_parent_profile`) | `supabase/migrations/20261024_directory_schema.sql`, `20261025_directory_functions.sql` |
| B. Coordination (database) | Events, tasks, assignments, change requests and contribution notes with the capacity and uniqueness rules, policies for admins in reach and the assigned family, allergen and note visibility; event, task and note functions | `20261026_coordination_schema.sql`, `20261027_coordination_functions.sql` |
| C. Kernel use cases (database) | Duty list and detail, sign-up (task row lock, fixed check order), admin assign and remove; swap partner list, request, answer, withdraw, cancellation request and the admin decisions (tasks locked in id order, audit events in the same transaction); family archive and restore, the invitation link for a parent, dashboard counts, governance revoke; teacher schedule; lifecycle list and run; U2 functions rewritten onto the new tables; placeholder tables dropped | `20261028_kernel_signup.sql`, `20261029_kernel_swaps.sql`, `20261030_kernel_family.sql`, `20261031_schedule.sql`, `20261032_lifecycle.sql`, `20261033_identity_group_reach.sql`, `20261034_assignments_policy_speed.sql`, `20261035_governance_list.sql`, `20261035_placeholder_drop.sql` |
| D. Adapters and application layer | Database adapters behind the parent, admin and teacher ports, the one gateway that maps database answers and errors, the family derived from the signed-in account (no constants), the exported hand-off list for U4, port additions (`respondToSwap`, `withdrawRequest`, `listSwapRequests`, partner version on `requestSwap`, admin payloads), the production composition and session wiring, the parent matrix and role policy for the new actions | `src/data/` (15 production files), `src/application/` (port and payload additions), `src/runtime/production/{access,composition,services}.ts`, `src/access/{role-policy,types}.ts`, `app/*/_lib/{facade,session}.ts` |
| E. Screens | Partner picking on the parent swap page, the new incoming and own requests page (`/szulo/cserek`) with Confirm, Decline and Withdraw, extended admin forms (family with parents, contacts, children and group; school year; group; child; event notes; task with event, capacity and times; assign with a family selector), Hungarian messages for the new codes, the production home, the sign-out action | `app/szulo/cserek/`, `app/szulo/_components/`, `app/admin/_components/{RecordFields,TaskFields}.tsx`, `app/admin/_lib/`, `app/_identity/` |
| F. Clean-up, configuration, documentation (this batch) | The four replaced modules deleted with their tests; guard test; scope list and inventory count updated; full verification chain run; flaky-test cause found and fixed; this summary, `source-manifest.json` and `traceability.json` | `scripts/verification/replaced-modules.test.ts`, `scripts/verification/lint-scope.test.ts`, `tests/coverage/production-inventory.test.ts`, `tests/database/data-adapters.test.ts`, `tests/database/directory-timing.test.ts` |

## Step 31: the replaced modules

`src/directory`, `src/coordination`, `src/parent-experience` and `src/privacy-audit` (18 files, 13 of them production source, with their five test files) are deleted. Before deleting, every ledger row naming them was checked by reading against the passing new tests:

| Ledger rows | Held by | Proof (passing) |
|---|---|---|
| D1, D2, D3, D4, D5, D6, D7, D8 | BR30.1 to BR30.8 | `tests/database/directory-schema.test.ts`, `directory-functions.test.ts`, `directory-link.test.ts`, `kernel-family.test.ts` |
| D9, D10, D11, D12, D13, D14, D15 | BR31.2 to BR31.10 | `kernel-signup.test.ts`, `kernel-race.test.ts`, `kernel-swaps.test.ts`, `coordination-schema.test.ts`, `coordination-functions.test.ts`, `src/data/notification-use-cases.test.ts` |
| D20, D21 | BR31.11, BR32.2, BR32.8 | `tests/database/data-adapters.test.ts` (code-by-code), `src/data/results.test.ts`, `src/data/parent-port.test.ts`, `src/data/session.test.ts` |
| D22 | dropped (synthetic fixtures) | `src/runtime/production/access.test.ts` (no fixed family, parent, login or organization in the production path) and the new `scripts/verification/replaced-modules.test.ts` |
| D30 | BR35.1, BR35.2 | `tests/database/lifecycle.test.ts` |
| D31 | moved to U1 | **No proof exists, see open point 1** |
| D34 | BR31.11, BR31.8 | `kernel-signup.test.ts`, `data-adapters.test.ts` |

Notes on rows whose old wording differs from the new code: D5 "duplicate child refused" has no old test and no counterpart (a child is a row with its own id inside one family; the rule that remained is the cross-organization refusal, proven). The old lifecycle rule "enrolled sibling" is dropped by design (archiving archives all children).

The new guard test `scripts/verification/replaced-modules.test.ts` (3 tests) fails if one of the four folders comes back, if any file under `app`, `src`, `tests` or `scripts` imports one, or if a verification configuration file names one. `scripts/verification/lint-scope.test.ts` lost the four entries from its legacy list (its own test forces that); `tests/coverage/production-inventory.test.ts` now expects 227 production files (240 minus the 13 deleted).

The four running adapters (`src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`) and `src/teacher-tracking` stay (deviation 1).

## Deviations from the design and decisions to confirm

1. **BR34.1 correction.** The design listed the four running adapters and `src/teacher-tracking` for deletion in U3. They are still the running code of the synthetic composition, which only U5 removes, so U3 built the database adapters beside them (in the production composition) and U5 deletes the old code with its ledger proof (D16 to D19, D23 to D29, D32 to D35). The design files are frozen by review, so the correction is recorded here and in the plan.
2. **Audit group, option A (owner decision).** The audit group of a family-scoped event is the first group (lowest id) among the family's active memberships whoever the actor is, and null only for a family without an active membership. `entities.md` said "that the acting admin reaches, null for a super admin"; that would have hidden the events of super admins, denied attempts and invitation acceptances from the group's admins and broken U2's tests. For a family with one membership the result equals what U2 always produced (`20261033_identity_group_reach.sql`).
3. **Capacity trigger split.** One-place-per-family uniqueness is a unique index; the rule "taken places never exceed capacity" is a deferred constraint trigger judged on the final state of the transaction, while the use-case functions lock the task and check first and answer with a coded result (`20261026_coordination_schema.sql`). This lets an exchange of two places pass through an intermediate state.
4. **Speed-fix migration.** `20261034_assignments_policy_speed.sql` rewrites the assignment read policy so the group reach is computed once per statement (an initplan) instead of once per row; listing the 1500 assignments of the 150-family data set took about 0.9 s before and about 5 ms after. The rule is unchanged. A merged migration was not edited; this is a new file.
5. **`families.anonymized_at` column** added in `20261030_kernel_family.sql` so the lifecycle can mark an anonymized family and never list or process it twice (the design had no column for it).
6. **Late reservation release in `invitation_accept`.** When linking the parent is refused after the invitation was reserved, the reservation goes back to pending, so a refused acceptance leaves the invitation usable (the U2 function released only on its own earlier failures).
7. **Group and school-year archive and restore are super-admin only** (BR30.9 reading), and **organization rename is not built** (no requirement asks for it; the organization row is created by the first-super-admin command).
8. **Optional profile** is never in the table rights: it is read through the function `directory_parent_profile` for the parent and for admins in reach with consent.
9. **Parents read tasks only through `duty_list` and `duty_get`** (no parent table rights on events or tasks), so the allergen and note rules live in one place.
10. **Task category is free text** with a length limit (the design left the list open).
11. **Lint-scope legacy allow-list** kept in `scripts/verification/lint-scope.test.ts` for the folders U4 and U5 still own; it only shrinks.
12. **Production configuration accepts `http` for the loopback host only** (`127.0.0.1`, `localhost`, `[::1]`), so a production build can run against the local stack and never sends data unencrypted over a network (`src/runtime/config.ts`).
13. **Two Hungarian screen choices:** a new family needs a group in the admin form (a family without a group cannot take tasks); a parent block that is linked to an account is shown fixed (read only), because linking is a super-admin correction.
14. **Two migration files carry the number 20261035** (`governance_list` and `placeholder_drop`). They sort by name, so the placeholder drop still runs last, as its comment requires; the plan's own numbering had one file there.
15. **Pre-existing type errors fixed.** `npm run typecheck` reported 8 errors in `tests/database/data-adapters.test.ts` from the earlier batch (untyped fields of the admin detail). The test type was completed; no production code changed.

## Repair pass after the architecture review (outside the workflow, 2026-10-22)

The review (`reviews/review-01.md`, READY with two Major findings) was repaired in a separate pass. Every claim was reproduced on the real stack before code changed; the numbers of the verification table below were refreshed and are marked "after repair".

| Finding | Confirmed | Change |
|---|---|---|
| R-01 Major: family edit page failed for a parent with consent but empty profile | Yes. A real-stack test (`records.get` through the real adapter) failed with `UNEXPECTED_DEPENDENCY_FAILURE` before the fix | New `20261035_integrity_directory_reads.sql`: `directory_parent_profile` now answers the empty string (not NULL) to a reader who may see the profile. Who may see it is unchanged (BR30.4): everyone else still gets NULL, which a test proves. The client guard is unchanged on purpose. |
| R-02 Major: lifecycle left invitations and e-mail addresses | Yes. With the old function the three extended lifecycle tests failed (the search found the addresses in `invitations`) | New `20261035_integrity_lifecycle.sql` replaces `lifecycle_run`: every invitation of the family (scope is the family, or the target is one of its parents) is deleted whatever its status, in the same transaction, in both paths. Deleting is possible because only `replaces_invitation_id` points at an invitation, and it is `on delete set null`. U2's tests stay green. |
| R-03 Minor: import and reminders on the synthetic store | Yes (read and by test) | Small and safe, so done: `getInterimAdvancedPort()` now returns the stateless `src/admin-advanced/interim-port.ts`. Reading the import status or the reminders answers the empty state, every change (preview, resolve, commit, recover, retry) answers denied. No fixture data, no shared preview, no fake success. The synthetic mode keeps its demo store. U4 replaces this port with the real one. |
| R-04 Minor: fail-open approval decision | Yes (read; a missing field approved) | `app/admin/actions.ts` and `src/data/admin-tasks.ts` accept only exactly `approved` or `rejected`; anything else answers a validation result and nothing is sent. Tests in `tests/coverage/admin-actions.test.ts` and `src/data/admin-port.test.ts`. Existing coverage tests that sent no decision now send `approved`. |
| R-05 Minor: `duty_get` showed any task of the organization | Yes. The old test proved it (it expected the state `ineligible` for a task of another group) | `duty_get` (same new file as R-01) now follows `duty_list`: a task of an active group the family is an active member of, or a task the family holds a place on; anything else answers `duty_not_found`, like a missing task. The old expectation in `kernel-signup.test.ts` was changed on purpose; new test covers join and leave. |
| R-06 Minor: `readChild` matched by name | Yes (read) | The new child is read as the newest of its family and name (`created_at` descending, then `id` descending). `directory_save` still returns no child ids; adding that would mean rewriting the large save function. A test with repeated names proves the choice. Residual case: two admins creating a child of the same name in the same family within the same instant could be confused with each other; not considered worth a rewrite. |
| R-07 Minor: counts not reproduced | Now reproduced | See the table below. |

Documented exception to "nothing personal remains" (BR35.2, NFR1.36): the parents' **sign-in accounts keep their e-mail address** after the lifecycle. U2 deactivates an account and never deletes it (the sign-in service's user row and the `accounts` row stay, with the status `deactivated`, which ends every session). The invitations, contacts, profiles, notes, reasons and names do not remain. A test asserts that the account is deactivated and the exception is the only place the original e-mail is found. An invitation for the same address with another role (for example a group admin invitation) is not the family's and stays.

Two migration numbers: both new files carry the number 20261035 and sort by name between `20261035_governance_list.sql` and `20261035_placeholder_drop.sql` (`integrity_...` is after `governance_...` and before `placeholder_...`), so the placeholder drop is still last. The migration-order test passes unchanged. A first replay of an old function file into the local `public` schema (to prove R-02) left three functions with a wrong pinned search path in the local database only; they were dropped and re-created by the real migration runner and the identity catalogue test passes (328).

The production-inventory test now expects 228 files (227 plus `src/admin-advanced/interim-port.ts`).

## Flaky database tests: finding and fix

The intermittent failures of the directory suite (and once of the identity suite) were real, not timing. Cause, found by logging every delete of sign-in sessions during repeated runs: `tests/database/data-adapters.test.ts` gave the shared test identities a password through the sign-in service (`setPassword`). That service ends every session of the user on a password change (it ran `DELETE FROM sessions WHERE user_id = ...`), including the sessions that other database test files, running at the same moment in other schemas, had created for the same shared identities. Those files then saw `session_inactive` or "denied" for a valid person, or zero rows for a super admin (for example "partner list ... session_inactive", "contribution_notes as super: 0 instead of 2", "lifecycle_list denied", "RESTORE_CONFLICT expected, session_inactive"). It appeared as a failure only when the file ran at the same time as others, which is why reruns passed. It also reproduced whenever a second test run overlapped (for example the shuffled run next to the directory run).

Fix (test code only): the data-adapters test now writes the password hash with SQL (`extensions.crypt`) and signs in through the service, which does not end other sessions. After the fix a logged run of 10 directory-suite runs showed no session delete by the sign-in service, and all 10 passed; 10 identity-suite runs passed; 3 directory runs overlapping a full shuffled run passed, and that shuffled run (32 files) passed.

Timing tests: no timing failure was reproduced (worst measured call was 145 ms against the 1500 ms ceiling). As the owner asked, the helper now makes one unmeasured warm-up call before timing, so a cold plan cache cannot count against a call; the 1500 ms ceiling applies to every measured run (the worst of nine), the typical targets are still reported, and nothing was relaxed.

The one identity-suite failure seen on a first run after the stack start could not be reproduced in 10 further runs and its output was not captured; it ran in a state where the shared sessions could have been ended by an earlier data-adapters run, which is the same mechanism.

## Verification results (this batch, Node 24.22, local stack)

| Check | Result |
|---|---|
| Strict type check, lint, format check | clean (after the data-adapters test type fix) |
| `verify:manifests` | valid (39 scenarios) |
| Node domain tests (`src/**`) | 539 passed, 0 failed (after repair; 533 before) |
| Node scripts tests | 125 passed (includes the 3 new guard tests) |
| Vitest delivery tests | 727 passed in 54 files (after repair; 726 before); with coverage 1391 passed in 120 files (this run includes the domain tests) |
| Coverage, floor 80 on lines, branches, functions | after repair: node native on `src`: lines 97.86, branches 90.63, functions 96.57; vitest istanbul: statements 96.55, branches 90.02, functions 96.93, lines 97.81. The production inventory check (228 files, every executable file measured) is inside the run. Nothing lowered |
| Scans | privacy 1066 files, secrets 1927 files, SAST 390 files, no-deploy 390 files: all pass |
| `npm audit` | high 0, critical 0; 4 moderate (the vitest 4.1.11 development tool chain, `@vitest/mocker`), unchanged by this unit, not blocking |
| Production build and start smoke | pass (`APP_RUNTIME_MODE=synthetic`, as `verify:local` runs it); `SMOKE_START_OK` |
| `test:bundle` | 4 passed |
| `test:database:stack` | 110 passed |
| `test:database:identity` | 328 passed |
| `test:database:directory` | 352 passed after repair (346 before; 14 files, each run in the default and a worker schema) |
| `test:database:shuffled` | 32 files in random order, passed (seeds 292577917 earlier failed because of the cause above; 492894832 passed after the fix) |
| `db:migrate` | 29 migrations after repair (the two new files applied once, then up to date); the shuffled run passed again after repair (32 files, seed 1629221989); typecheck, lint, format check clean; production build, `test:bundle` (4) and `smoke:start` pass; the new browser spec 9 passed and the whole browser suite 421 passed, 20 skipped, 0 failed, both on a fresh production build |
| New browser spec `directory-coordination.spec.ts` (production server on port 3140 over the real stack) | 9 passed in Chromium (the spec runs in one project; the other 18 entries are skipped by design), axe scan on every screen, parent task list page 64 to 82 ms (median 67 ms) |
| Existing browser suite as regression, three projects | 421 passed, 20 skipped, 0 failed (441 tests) |

Timings against NFR4 on the 150-family data set, median of nine warm calls (typical target 300 ms for reads, 500 ms for actions and the dashboard; ceiling 1500 ms): parent task list 2.8 ms, task detail 1.8, teacher schedule 3.1, admin lists 97 ms (families), 143 (tasks), 5 (assignments), sign-up 3.0, swap partner list 4.8, swap request 3.2, approval decision 4.9, family save 2.7, task save 3.1, settings save 3.8, dashboard 2.2, lifecycle list 5.2; access-check overhead of U2 about 7 ms (target 50, ceiling 200). All targets met.

CI: `.github/workflows/ci.yml` runs `npm run verify:local` inside one job with `timeout-minutes: 45`; `scripts/verification/run-local-verification.ts` contains the `database-directory` stage after the identity stage and before the shuffled stage, and `ci-config.test.ts` guards that order and the file list. No change was needed. By the durations measured in this run (browser suite 5.7 minutes, shuffled run a few minutes, each other stage well under three minutes) the whole chain fits in the 45 minutes with room; the full `verify:local` chain was not run end to end here.

## Tests written but not executed in this stage

- `npm run test:database:roles` (9 tests, `tests/database/current-role-migration.test.ts`): cannot run on this machine, the PostgreSQL 18 tools (`initdb`, `pg_ctl`, `psql`) are not installed; the 9 tests are cancelled before starting. The suite and the migration it checks are not touched by this unit. It needs a CI run or a machine with PostgreSQL 18.
- The full `verify:local` pipeline and the GitHub Actions job were not run (no CI here); the stages were run one by one as listed above.
- `npm run build` was run in synthetic runtime mode, as the pipeline does; production mode is exercised by the browser spec's own production server over the real stack, not by a separate production build.

## The use cases U4 must connect to notifications (BR31.10)

Exported as `NOTIFICATION_USE_CASES` in `src/data/index.ts` and compared with the database functions that change assignments by `src/data/notification-use-cases.test.ts`, so a new one cannot be added unnoticed. Parent side: `duty.sign_up`, `swap.request`, `swap.respond`, `swap.withdraw`, `cancellation.request`. Admin side: `assignment.assign`, `assignment.remove`, `swap.decide`, `cancellation.decide`, `task.save` (when it cancels a task or closes places), `family.archive`. U3 creates no notification record and no outbox table; U4 adds the writes inside these same database functions. Until then the parent notification page returns the empty state for real accounts (BR32.9).

## Outstanding evidence and open points

1. **Audit retention purge has no implementation or proof (ledger D31).** The old rule "audit events older than 365 days without an investigation hold are purged" lived only in the deleted in-memory service. The ledger and BR35.2 say U1's retention rules carry it, but U1's record and migrations contain no retention or purge function (U1 BR3.5 is the one-hold-per-target rule). The deleted code was not used at run time. The owner should decide whether the real database needs a purge (and where it belongs, U4 or a later unit); until then audit events are never purged.
2. Ledger rows D23, D32 and D35 depend on U4 and U5 closing them; D16 to D19, D24 to D29 and D33 stay open for U5 because of deviation 1.
3. Provisioned and cross-unit integrations are not verified until exercised against their real targets: the invitation mail path was exercised in U2; notification delivery belongs to U4.
4. Co-parent contact visibility (answer Q8) goes beyond the domain design (ADR-010) and stays recorded as an owner decision.
5. **Import and reminders until U4 (R-03).** In the production mode these operations no longer run on the synthetic in-memory store: reads answer the empty state and changes answer denied (`src/admin-advanced/interim-port.ts`). So a real admin sees "nothing imported" and "no reminders", and cannot start or commit an import until U4 builds it. Before the repair the store showed fixture data, was shared by all admins and an import commit reported success without changing anything. Open for U4: replace the port with the real one and decide what the import screens say meanwhile (they show the generic denied message for an attempt).
6. The deactivated parent accounts keep their e-mail by U2's design (see the repair section); the owner may decide later whether accounts of a left family should be deleted instead, which would be a U2 change.
7. The stack ran with `DB_ALLOW_ALL_INTERFACES=1` (ports reachable from the local network, as approved for the trusted network) and was stopped afterwards (data kept).

## Corrections to earlier records

- The approved plan listed 10 to 15 tests per component and about 400 tests; the unit's own database suites count 346 tests in the directory stage, plus tests in `src/data`, the integration and unit folders, and the 9-test browser spec per project.
- The earlier note "9 passing browser tests" refers to the new browser spec in one project; the three-project existing suite is 441 tests (421 passed, 20 skipped).
