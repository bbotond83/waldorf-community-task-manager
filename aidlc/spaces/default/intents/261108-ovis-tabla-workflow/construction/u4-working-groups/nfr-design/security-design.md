# Security Design: u4-working-groups

This file sets out how the targets in `security-requirements.md` are met. It follows `functional-spec.md`, `rules.md`, `tech-stack-decisions.md`, ADR-008 and ADR-010, and the contracts C1, C2, C7, C8 and C16 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Parent commands.** `working_group_join` and `working_group_leave` check the session first. They then read the caller's own parent with U1's `current_parent_id()`, and they take no parent id at all (NFR3.10).

- A caller without a current parent gets the denied result. This covers a teacher, and a super admin without a parent record.
- Leave also refuses a membership whose parent is not the caller, and a membership id that does not exist, with the same denied result. So an outsider cannot tell someone else's membership from a missing one. The check comes before any test of whether the membership is active.

**Coordinator commands.** `coordinator_appoint` and `coordinator_revoke` call U1's super-admin decision point right after the session check, before any lookup. A parent, a teacher or a coordinator of the same group gets the same denied result whatever they send, and the denial is audited the way today's denials are (NFR3.11).

**Old path.** The general role-change function keeps its order:
1. It checks the session and the caller's authorization.
2. It then refuses `role = 'group_admin'` with GRANT_USE_COORDINATOR_ACTION. This applies to adding and to revoking (NFR3.12).

So an unauthorised caller still gets the denied result first.

**Next request.** Every rights check (`can_manage_group`, `has_current_role_scope`) reads the current grant rows, and `end_admin` raises the account's authorization version. A revoked coordinator, or one who left, is therefore refused from their next request, also within the same session (NFR3.13).

**Unavailable groups.** Every U4 function resolves the group, or the membership's group, against the caller's community. A missing group, an archived group (for join, appoint and the page) and a group in another community all give one code, GROUP_UNAVAILABLE, with one message. The one exception to NFR3.14 is that leave and revoke on an archived group are allowed (BR40.6, BR41.5): ending a membership or a right grants nothing, and refusing it would strand rows a super admin can no longer reach. A missing or other-community group still answers GROUP_UNAVAILABLE for them (NFR3.14).

**Rights.**
- Signed-in accounts keep `select` only.
- Every new or redefined function starts with `revoke all`, pins `set search_path from current`, and then gets an explicit `grant execute`.
- Only the page read and the four commands are granted to `authenticated`.
- `group_members`, `group_coordinators`, the two removal steps, the two contact helpers, `end_admin` and `lifecycle_run_core` are granted to nobody.
- The `working_group` facts function U5 calls is granted to nobody, like U5's own facts functions, because `notice_send` runs as its owner.
- `create or replace` keeps a function's old grants, so U4's migration restates `revoke all` and then the intended grants after each function it redefines (`end_admin`, the general role-change function, `directory_list` and `lifecycle_run_core`), not only after the new ones.
- `identity-catalogue.test.ts` gains an entry for every new function and for `end_admin`'s new signature, each with its expected grants.
- No function grants a table write right (NFR3.15).

**Routes and the matrix.**
- The three routes (`/szulo/munkacsoportok/[id]`, `/teacher/munkacsoportok/[id]` and `/admin/munkacsoportok/[id]`) are added to `role-policy.ts`, `authorization.ts`, the navigation and `verification/authorization-matrix.json` together.
- Today's checks would stay green without a matrix row, and the matrix mixes exact rows with wildcard rows (such as `/szulo/feladatok/**`). So U4 adds exact rows for the three routes (the route text with `[id]`, no wildcard), one per role, each saying allow or deny. A new unit test fails unless each of the three routes has an exact row for every role with the expected result; wildcard rows do not count for this check.
- A browser test opens each route as each role (NFR3.16).

## Data Protection Design

| Requirement | Design |
|---|---|
| NFR1.8 | The seed and fixtures use only the invented families of `scripts/db/seed/data.ts`. Every phone number and email in a new test is added to `scripts/verification/privacy-allowlist.json`. |
| NFR1.9 | Two internal helpers are moved out of `directory_list`'s inline logic. `directory_parent_shares(parent_id)` holds the BR31.5 test: ticked, parent active, linked account active. `directory_parent_email(parent_id)` holds the email rule of BR30.6. `directory_list` and `working_group_detail` both call them. The detail function selects phone and email only when the viewer is the member, a teacher, a super admin, or the member is shared. A withheld field is never put into the result, so no later step can leak it (ADR-008). A test reads the same member as the same viewer through both functions and compares the two results. |
| NFR1.10 | The result row is built from a fixed column list: membership id, parent id, full name, phone, email, coordinator flag, self flag, and version for a super admin only. It holds no profile field and no child. |
| NFR1.11 | `group_members` and `group_coordinators` return `uuid[]` only. |

## Consent Design

No member row is cached. The page reads the sharing value through `directory_parent_shares` on every load, so the next load after a sharing change shows the new state (NFR2.3).

## Audit Design

| Requirement | Design |
|---|---|
| NFR4.15 | Every path writes its audit row through `end_admin` or `grant_admin`, inside the transaction of its change: appoint writes `role.grant`; revoke, leave, the removal block and the lifecycle step write `role.revoke` with their reason. |
| NFR4.16 | The audit rows carry the account id, the group id and the reason text only. |
| NFR4.17 | A repeated idempotency key returns the stored result before any write. A refused appointment aborts before `grant_admin`, so it writes no `role.grant`. |

## Email Design

| Requirement | Design |
|---|---|
| NFR10.5 | The migration adds the target row `working_group`, with a facts function that U5 calls as `f(target_id, parent_id, kind)`. That function returns the group's name and the path of its page, and still answers for an archived group, so a revoke in an archived group can still be sent. The two kind rows give the title prefixes. U5's fixed template adds nothing else. |
| NFR10.6 | `notice_send` already skips a parent without an active account. U4 adds no check of its own, and a test covers the case after a revoke. |

## Input Validation

- **Ids.** These go through the existing safe parser and are checked against the caller's community.
- **Idempotency keys.** These use the C1 length check.
- **Free text.** U4's commands take none.
- **Display.** React escapes everything shown on the page.

## Threat Coverage

The threats in `security-requirements.md` are covered by the designs above:
- Direct calls are covered by the parent and coordinator commands.
- The old grant path is closed.
- Leftover rights are covered in `reliability-design.md`.
- Hidden contact details are covered by NFR1.9.
- Probing for groups is covered by unavailable groups.
- A changed search path is covered by the rights.
