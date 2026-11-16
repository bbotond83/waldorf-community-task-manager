# Reliability Requirements: u4-working-groups

Sources: NFR6, NFR7 and NFR11 in `requirements.md`, `functional-spec.md` and `rules.md` of this Unit, and `contract-summary.md`. Nothing is hosted in this work (`technology-stack.md`), so no availability target applies.

## Data Integrity

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR7.12 | A coordinator's leave is all-or-nothing. The membership end, the grant revocation and the audit event commit together, or none of them do (BR40.5). | A forced failure in the revocation leaves the membership active and the grant in place. |
| NFR7.13 | Appoint and revoke are all-or-nothing. The grant change, the version bump, the audit event, the notice and its queued email commit together, or none of them do (BR41.3, BR41.5, BR41.6). | A forced failure in `notice_send` leaves no grant change and no notice. |
| NFR7.14 | Appointing and then revoking the same grant gives two notices and two queued emails. The once key includes the kind (BR41.6). | A test appoints, revokes, and counts the notices and emails. |
| NFR7.15 | After every writer named in BR41.8 has run, no unrevoked group-admin grant is left without an active membership of the same group. The writers are join, leave, appoint, revoke, the removal block and `lifecycle_run_core`. | An invariant check runs after each writer's tests. |
| NFR7.16 | A removal of a coordinator through U4's block and then U3's block commits in full. A removal of a parent without an account, or without any grant, does not abort (BR44.2). | Tests for a coordinator, a member without a grant, and a parent without an account. |
| NFR7.17 | The structure change applies over U1 to U5's data without losing memberships or grants. It adds `version`, filled with 1, and `endReason`, filled with `left` on rows that have already ended. | A test applies the migration over a seeded database and compares the row counts. |
| NFR7.18 | `end_admin` gains its reason through a new definition with three parameters, and the migration drops the old two-parameter one. Only one `end_admin` exists afterwards, and it is still granted to no signed-in role. | A database test reads the function catalogue and finds exactly one `end_admin`, taking `(uuid, uuid, text)`; `identity-catalogue.test.ts` still finds it granted to nobody. |

Recovery is forward-only: a defect found after merge is fixed by a new migration file. The project-wide checks of `team.md` (`npm run verify:local`, the `Validate` check and the 80% coverage floor) apply unchanged and are not repeated here.

## Testing Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR6.6 | Every database rule gets the fixed test list: allowed, refused, out of reach, outdated screen, repeated click, and two people at once. For the read rules, the test plan records why a case has no meaning. | The test plan has one row per rule, and every cell names a test or "nem értelmezhető" with its reason. |
| NFR6.7 | Each new database test file is added to its `test:database:*` script and to the shuffled run. | The scripts name the file. |
| NFR6.8 | Closing the general role-change function for group_admin (BR41.7) closes both adding and revoking. The refusal comes after the caller's authorization check, so an unauthorised caller is still denied first. In the same pull request, the tests that add, set up or revoke group-admin grants through it change: in `community-roles.test.ts` (including BR3.11 and BR3.12) they use a fixture insert or the coordinator actions, and the `identity-grants.test.ts` case that expects `denied` is kept or updated to match the order. | No test reaches group_admin through the general function except the BR41.7 refusal tests. |

## Existing Behaviour

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR11.4 | When `lifecycle_run_core` deletes or anonymises a family, it first ends every unrevoked group-admin grant of the family's parents, with reason removed. It finds the grants through each parent's account link before it clears that link, and skips parents without one. | Lifecycle tests for a family with a coordinator, a family whose parent has no account, and a family already removed. |
| NFR11.5 | Deleting memberships in `lifecycle_run_core` stays as today, because the family's history is erased there. The "ended rows stay as history" rule of `entities.md` applies to leaving and removal, not to erasure. | The lifecycle erasure test still finds no membership row for the erased family. |
| NFR11.6 | The removal preview and apply steps (C16) count and end only memberships and group-admin grants (BR44.1, BR44.2). | Tests for both subject kinds. |
