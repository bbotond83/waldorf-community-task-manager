# Reliability Design: u4-working-groups

This file sets out how the targets in `reliability-requirements.md` are met. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`. Nothing is hosted, so no availability target or failover applies.

## Transaction Design

| Requirement | Design |
|---|---|
| NFR7.12 | `working_group_leave` is one function. It locks the membership, reads whether the caller holds an unrevoked group-admin grant on the group, calls `end_admin(parent, group, 'left_group')` when they do, and then ends the membership. Any refusal is raised through U3R00, so the whole call rolls back. A test forces `end_admin` to fail and finds the membership still active. |
| NFR7.13 | Appoint runs `grant_admin`, the version bump and `notice_send` in one function. Revoke runs `end_admin`, the version bump and `notice_send` in one function. A refusal from `notice_send` rolls the change back. A test makes the notice step fail and finds no change. |
| NFR7.14 | The once key is built as `kind || ':' || grant_id`. U5 adds `':' || parent_id` for its de-duplication, so an appointment and a revocation of the same grant are two keys. |
| NFR7.15 | Every writer ends the grant before the membership: join creates no grant, leave and revoke end it through `end_admin`, the removal block does the same, and the lifecycle step ends grants before its delete. A test helper finds every unrevoked group-admin grant without an active membership of the same group, and the test of each writer calls it afterwards. |
| NFR7.16 | `working_groups_removal_apply` first takes the family, account and parent locks itself (`scalability-design.md`), then looks up the parent's account link. For each locked membership, it calls `end_admin(parent, group, 'removed')` only when the account holds an unrevoked grant on that group, so neither of `end_admin`'s refusals can fire. U14 must call U4's block before U3's directory block, which clears the account link. A test runs the two blocks in that order for a coordinator, for a member without a grant and for a parent without an account. |
| NFR7.17 | The migration adds `version integer not null default 1` and `end_reason text check (end_reason in ('left','removed'))`. It fills `end_reason = 'left'` on rows that have already ended, then adds the check that `end_reason` is present exactly when the status is ended. A test applies the migration over a seeded database and compares the counts. |
| NFR7.18 | The migration runs `drop function end_admin(uuid, uuid)`, then creates `end_admin(p_parent_id uuid, p_group_id uuid, p_reason text default 'revoked')`. The reason must be one of `revoked`, `left_group` or `removed`, and it is written as `grant:group_admin:<reason>`. The new function starts with `revoke all` and gets no grant. A database test reads `pg_proc` and finds exactly one `end_admin` with the arguments `(uuid, uuid, text)`. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file. The project-wide checks of `team.md` apply unchanged.

## Testing Design

| Requirement | Design |
|---|---|
| NFR6.6 | The test plan has one row per BR40 to BR44 rule, with a cell for each case of the fixed list. Each cell names a test, or says "nem értelmezhető" with its reason. |
| NFR6.7 | The new file `tests/database/working-groups.test.ts` is added to `test:database:directory` in `package.json` (where `community-roles.test.ts` runs) and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`, which is the shuffled run's file list. Any further file is added to both the same way. |
| NFR6.8 | The fixtures in `community-roles.test.ts` that set up group admins through the general function insert the grant rows directly through the test's service-role helper. Its BR3.11 and BR3.12 revoke cases use `coordinator_revoke`, so their fixtures insert an active membership of the same group alongside each grant, because `coordinator_revoke` needs one. The `identity-grants.test.ts` case that expects `denied` keeps its expectation, because authorization runs first. New cases assert GRANT_USE_COORDINATOR_ACTION for a super admin, for both adding and revoking. |

## Existing Behaviour

| Requirement | Design |
|---|---|
| NFR11.4 | `lifecycle_run_core` gains one step right after it locks the family row and before its account-deactivation loop, in the order set in `scalability-design.md` (accounts, parents, memberships, then grants). Then, for each parent of the family that still has an account link, it ends each unrevoked group-admin grant of that account, with the reason `removed`, through `end_admin`. It calls `end_admin` only for grants it has found, so `end_admin`'s `grant_not_found` refusal cannot fire. Parents without a link are skipped, because their grants were already ended by the removal block. |
| NFR11.5 | The membership delete stays as it is. Erasure removes history on purpose. |
| NFR11.6 | The preview counts the subject's active memberships plus the account's unrevoked group-admin grants, and apply ends exactly those. Both handle a parent and a family. |
