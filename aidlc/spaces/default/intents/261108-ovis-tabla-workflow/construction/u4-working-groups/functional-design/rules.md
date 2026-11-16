# Business Rules: u4-working-groups

Built from `unit-of-work.md` (U4), `unit-of-work-story-map.md`, `stories.md` (US2.1 to US2.3), `requirements.md` (FR2.1, FR2.2, FR2.4, NFR3 to NFR6), `components.md` (WorkingGroups, Identity), `contract-summary.md` (C1, C2, C7, C8, C16), ADR-008 and ADR-010, the U1 rules BR3.2, BR3.6, BR3.11 and BR3.12, the U3 directory rules (BR30, BR31.5) and removal and lifecycle functions and `functional-design-questions.md` (Q1 to Q5). Every rule is enforced on the database side; screens only present the outcome. Every command follows the C1 convention and every rule gets the fixed test list, recorded in the test plan's table (U1 BR6.2). Contains no names or contact details.

## Rules

```yaml
rules:
  - id: BR40.1
    statement: A parent joins an active working group of their community themself, and is a member at once.
    category: authorization
    applies_to: [WorkingGroupMembership]
    trigger: the join command
    logic: The caller's family row and then their parent row are locked for share, in the fixed lock order (family, then parent), so a removal running at the same time either finishes first or waits. IF the session is active AND the caller has a current parent who is active AND whose family is active AND the group is active in the caller's community THEN an active membership is created for the caller's own parent with joinedAt now. The command names no parent; it always acts for the caller (Q2).
    violation: Denied refusal for a caller with no current parent (a teacher, or a super admin without a parent record). A group that is archived or in another community is refused as GROUP_UNAVAILABLE, the same answer as a missing one.
    source: FR2.1, AC2.1.1, C2, the lock order of team.md
  - id: BR40.2
    statement: Joining one group leaves the caller's other memberships unchanged.
    category: constraint
    applies_to: [WorkingGroupMembership]
    trigger: the join command
    logic: Memberships are independent per group. IF the caller is already an active member of other groups THEN those stay active.
    violation: Not representable.
    source: FR2.1, AC2.1.2
  - id: BR40.3
    statement: Joining a group you are already in creates no second membership.
    category: constraint
    applies_to: [WorkingGroupMembership]
    trigger: a repeated or concurrent join
    logic: A repeated idempotency key returns the stored result. A new key while the caller is already an active member returns success with the existing membership's id and the code ALREADY_MEMBER. Two joins at once for the same parent and group end with one active membership, backed by the one-active-membership constraint.
    violation: None; the caller is a member once.
    source: AC2.1.3, NFR5, C1
  - id: BR40.4
    statement: A parent leaves a group themself; the membership ends and they are no longer listed, while their past claims stay.
    category: authorization
    applies_to: [WorkingGroupMembership]
    trigger: the leave command, naming the caller's own membership and its expected version
    logic: The membership row is locked. The checks run in this order. IF it is not the caller's own THEN denied. IF it is no longer active THEN NOT_A_MEMBER. IF the version differs THEN VERSION_CONFLICT. Otherwise status becomes ended, endedAt now, endReason left, version up by one. Claims, sign-ups and done marks belong to other records and are not touched. The version check is kept on purpose: an appointment or revocation since the page was loaded raises the version, so a parent whose page did not show the coordinator warning of BR42.4 is asked to reload rather than losing a right they did not know about.
    violation: Denied, NOT_A_MEMBER or VERSION_CONFLICT; nothing changes.
    source: FR2.1, AC2.1.4, C1
  - id: BR40.5
    statement: A coordinator who leaves loses that group's admin right in the same step, and the revocation is audited.
    category: policy
    applies_to: [WorkingGroupMembership, RoleGrant]
    trigger: the leave command, when the caller holds an unrevoked group-admin grant on that group
    logic: In the same transaction as ending the membership, Identity's end_admin revokes the grant and writes the role.revoke audit event. U4's migration gives end_admin an optional reason (revoked, left_group, removed; default revoked) that it writes into the audit detail as grant:group_admin:<reason>; existing callers keep the default, and its refusals stay as U1 made them. Here the reason is left_group, and end_admin is called only when the grant exists, read under the membership lock. IF end_admin refuses THEN the membership stays active. The person gets no notice, because they acted themself.
    violation: The whole leave rolls back.
    source: AC2.1.5, C2, ADR-010, NFR4
  - id: BR40.6
    statement: A membership of an archived group can still be ended.
    category: policy
    applies_to: [WorkingGroupMembership]
    trigger: the leave command on a group a super admin has archived
    logic: Leaving never grants anything, so the group's status does not stop it. Joining an archived group is refused (BR40.1).
    violation: None.
    source: FR2.1

  - id: BR41.1
    statement: Only a super admin appoints or revokes a coordinator.
    category: authorization
    applies_to: [RoleGrant]
    trigger: the appoint and revoke commands
    logic: IF the caller is not a super admin THEN refuse, including a coordinator of the same group.
    violation: Denied refusal with no change; the attempt is audited as today's denials are.
    source: FR2.2, BR3.6 of U1, NFR3
  - id: BR41.2
    statement: Only an active member of the group can be appointed its coordinator.
    category: validation
    applies_to: [RoleGrant, WorkingGroupMembership]
    trigger: the appoint command, naming a membership and its expected version
    logic: The membership row is locked; the command names the membership, so the group is the membership's own. IF the membership is missing or in another community THEN GROUP_UNAVAILABLE. IF its group is archived THEN GROUP_UNAVAILABLE, because grant_admin refuses an archived group (its scope_not_found is mapped to this code). IF the membership is not active THEN NOT_A_MEMBER. The screen explains that the parent must press Csatlakozom first; a super admin cannot add the membership for them (Q2).
    violation: Validation refusal with the reason; no grant is created.
    source: FR2.2, AC2.3.3
  - id: BR41.3
    statement: An appointed member gets the group-admin right on that group, recorded in the audit log.
    category: policy
    applies_to: [RoleGrant, WorkingGroupMembership]
    trigger: a valid appoint command
    logic: The checks run in this order: BR41.1, BR41.2, then ALREADY_COORDINATOR (BR41.4), then the version. IF the version matches THEN Identity's grant_admin adds the grant and writes the role.grant audit event, and the membership's version goes up by one, in one transaction. IF the parent has no active account or an inactive family THEN grant_admin's parent_required is mapped to ACCOUNT_REQUIRED and nothing changes; its grant_exists cannot arise after the BR41.4 check under the lock and is mapped to ALREADY_COORDINATOR if it does.
    violation: VERSION_CONFLICT or ACCOUNT_REQUIRED; the whole command rolls back.
    source: FR2.2, AC2.3.1, NFR4, C2
  - id: BR41.4
    statement: A group may have several coordinators.
    category: constraint
    applies_to: [RoleGrant]
    trigger: appointing a member of a group that already has a coordinator
    logic: Existing grants are untouched. IF the member is already a coordinator of this group THEN ALREADY_COORDINATOR. This check comes before the version check, so when two admins appoint the same member at once the second always gets ALREADY_COORDINATOR.
    violation: Conflict refusal for an existing coordinator; nothing changes.
    source: FR2.2, AC2.3.2
  - id: BR41.5
    statement: A revoked coordinator is refused from their next request, and stays a member.
    category: authorization
    applies_to: [RoleGrant]
    trigger: the revoke command, naming a membership and its expected version
    logic: The membership row is locked. The checks run in this order. IF the membership is missing or in another community THEN GROUP_UNAVAILABLE. IF it is no longer active THEN NOT_A_MEMBER (its grant already ended with it, BR40.5). IF its parent holds no unrevoked grant on the group THEN NOT_COORDINATOR. IF the version differs THEN VERSION_CONFLICT. Otherwise end_admin revokes the grant with reason revoked and audits it, and the membership's version goes up by one. Revoking in an archived group is allowed, as leaving is (BR40.6). The membership stays active. Every rights check reads the current grants, so the next request is refused (U1 BR3.11).
    violation: GROUP_UNAVAILABLE, NOT_A_MEMBER, NOT_COORDINATOR or VERSION_CONFLICT; nothing changes.
    source: FR2.2, AC2.3.4, NFR3
  - id: BR41.6
    statement: The person appointed or revoked gets an in-app notice and its email.
    category: policy
    applies_to: [RoleGrant]
    trigger: a successful appoint or revoke
    logic: In the same transaction, U5's notice_send sends the kind coordinator_appointed or coordinator_revoked to that parent, pointing at the working group, with the once key <kind>:<grant id>, for example coordinator_revoked:<grant id>. The kind is part of the key because U5 removes duplicates by once key and parent only, so a key of the grant id alone would silently drop the revocation notice of a grant whose appointment notice was already sent. A test appoints and then revokes the same grant and expects two notices and two emails. The notice and its email carry the group's name and link only, never another person's details.
    violation: A refusal from notice_send rolls the whole command back. A parent without an active account receives nothing, as U5 decides.
    source: Q4 and Q5 of functional-design-questions.md, C8, NFR10
  - id: BR41.7
    statement: The general role-change function no longer gives or takes the group-admin right.
    category: authorization
    applies_to: [RoleGrant]
    trigger: the general role-change command naming the group_admin role
    logic: IF the role is group_admin THEN refuse with GRANT_USE_COORDINATOR_ACTION before any change. Its other roles behave as before. Invitations still cannot carry group_admin (U1 BR3.6). The database tests that use this function to set up group admins (tests/database/community-roles.test.ts) move to a direct fixture insert in the same change, and its tests that add a group-admin grant through it become tests of this refusal.
    violation: Validation refusal; no grant changes.
    source: Q3 of functional-design-questions.md, AC2.3.3, FR2.2
  - id: BR41.8
    statement: An unrevoked group-admin grant exists only alongside an active membership of the same group.
    category: constraint
    applies_to: [RoleGrant, WorkingGroupMembership]
    trigger: every write that ends a membership or creates a grant
    logic: The writers that create a group-admin grant or end a membership are the appoint command (which needs an active membership, BR41.2), the revoke command, the leave command (BR40.5), the removal block (BR44.2) and the family-lifecycle step lifecycle_run_core, which deletes a family's memberships when it deletes or anonymises the family. U4's migration changes lifecycle_run_core to end every unrevoked group-admin grant of the family's parents, with reason removed, before it deletes their memberships and before it clears their account links. A test checks that no unrevoked group-admin grant lacks an active membership after each of these writers, including lifecycle_run_core.
    violation: The write that would break it is refused or rolls back.
    source: ADR-010, C2

  - id: BR42.1
    statement: Every signed-in role in the community reads an active group's page and its members.
    category: authorization
    applies_to: [WorkingGroup, WorkingGroupMembership]
    trigger: opening a working group's page
    logic: IF the session is active AND the caller may read the community (U1 can_read_community) AND the group is active in that community THEN return the group's name, description, school year, whether it has a coordinator, its member list (BR42.2) and the caller's own membership id and version when they are a member.
    violation: Denied refusal, never an empty page. An archived, missing or other-community group answers GROUP_UNAVAILABLE.
    source: FR2.4, C1, C2, C7
  - id: BR42.2
    statement: A member is shown by name to everyone, with phone and email only where the directory would show them.
    category: authorization
    applies_to: [WorkingGroupMembership]
    trigger: building each row of the member list
    logic: Each active member of an active parent and family is listed by full name (C6). Phone and email are added IF the viewer is that member, a super admin or a teacher, OR the member counts as shared (U3 BR31.5); the email is the one U3 BR30.6 shows. Today that logic sits inside U3's directory_list, so U4's migration moves it into two internal helpers, one for "counts as shared" and one for "the email shown", and changes directory_list to use them. A test checks that the directory and a group page show the same phone and email for the same viewer and member. Nothing else of the profile, and no child, is returned. Each row says whether the member is a coordinator and whether it is the viewer. Rows are ordered by name, then id.
    violation: A field the rule withholds is absent from what the database returns, also when the screen is bypassed.
    source: FR2.4, AC2.2.1, AC2.2.2, Q1 of functional-design-questions.md, ADR-008, U3 BR30.6 and BR31.5
  - id: BR42.3
    statement: A group with no coordinator says so, and only a super admin can manage it.
    category: policy
    applies_to: [WorkingGroup, RoleGrant]
    trigger: opening a group whose list has no coordinator
    logic: A coordinator is a member whose parent holds an unrevoked group-admin grant on the group and whose parent and family are active. IF there is none THEN the page shows "Ennek a csoportnak most nincs koordinátora. Amíg nincs, csak az adminisztrátor kezelheti." can_manage_group (U1 BR3.2) is then true for super admins only.
    violation: None.
    source: AC2.1.6, C2
  - id: BR42.4
    statement: Only a parent can join or leave, so the buttons appear only for them.
    category: policy
    applies_to: [WorkingGroupMembership]
    trigger: showing a group's page
    logic: IF the caller has a current parent THEN the page offers Csatlakozom when they are not a member and Kilépek when they are. A teacher and a super admin without a parent record see no button. A coordinator who presses Kilépek is first told "Ha kilépsz, megszűnik a koordinátori jogod ebben a csoportban."
    violation: None; the commands still refuse on their own (BR40.1).
    source: FR2.1, AC2.1.5
  - id: BR42.5
    statement: A super admin's group page offers the coordinator actions on every member.
    category: policy
    applies_to: [RoleGrant]
    trigger: a super admin opening a group's admin page
    logic: Each member row offers "Koordinátorrá teszem" or "Visszavonom a jogot", carrying the row's version. The page says that a coordinator must be a member and that an elected parent who is not listed must join first. The three new group routes are added to the navigation and to verification/authorization-matrix.json together with role-policy.ts and authorization.ts, as team.md requires for a change to who reaches what.
    violation: None; the commands still refuse on their own (BR41.1, BR41.2).
    source: FR2.2, Q2 of functional-design-questions.md, mockups.md Directory management

  - id: BR43.1
    statement: Other units read a group's members and coordinators through two internal facts functions.
    category: calculation
    applies_to: [WorkingGroupMembership, RoleGrant]
    trigger: a consumer of C7 asking for members or coordinators
    logic: group_members returns the parent ids of active memberships whose parent and family are active. group_coordinators returns those of them whose parent holds an unrevoked group-admin grant on the group. Both return ids only, ordered by id, and nothing for an unknown group. Neither is granted to signed-in users.
    violation: None.
    source: C7, ADR-010

  - id: BR44.1
    statement: The removal preview counts what removing a parent or family would end in working groups.
    category: calculation
    applies_to: [WorkingGroupMembership, RoleGrant]
    trigger: U14 calling the working-groups removal preview
    logic: FOR a parent, to_clear is that parent's active memberships plus their unrevoked group-admin grants. FOR a family, the same summed over its parents. to_flag is always 0. Nothing changes.
    violation: None; an unknown subject returns zero counts.
    source: C16
  - id: BR44.2
    statement: Removal ends the memberships and coordinator rights of the removed person.
    category: policy
    applies_to: [WorkingGroupMembership, RoleGrant]
    trigger: U14 calling the working-groups removal apply
    logic: U4's block runs before U3's directory block in U14's removal, because U3's block clears the parent's account link and the grants can then no longer be found; U14's design must call the blocks in this order (recorded as an open question for U14), and a test runs the whole removal of a coordinator. The subject's active memberships are locked by ascending id, after the family, account and parent locks U14 already holds. Each is ended with endReason removed and its version up by one. For each, end_admin with reason removed is called only when an unrevoked grant on that group exists for the parent's account; a parent without an account has no grant to end. No notice is sent. A group left with no coordinator shows BR42.3. Returns the same counts as the preview.
    violation: A refusal rolls back U14's whole removal.
    source: C16, NFR11, ADR-010
```

## Summary

| Group | Rules | What they settle |
|---|---|---|
| Joining and leaving | BR40.1 to BR40.6 | A parent acts for themself; one membership per group; leaving ends a coordinator's right |
| Coordinators | BR41.1 to BR41.8 | Super admin only, members only, several allowed, revocation at the next request, notice and email, one way in |
| Reading a group | BR42.1 to BR42.5 | Who reads the page, what a member row shows, the no-coordinator notice, which buttons appear |
| Facts for other units | BR43.1 | `group_members` and `group_coordinators` (C7) |
| Removal | BR44.1, BR44.2 | U4's block of the removal contract (C16) |

**Refusal codes and their Hungarian text.**

| Code | State | Text on screen |
|---|---|---|
| ALREADY_MEMBER | success | "Már tagja vagy ennek a csoportnak." |
| NOT_A_MEMBER (leave) | conflict | "Már nem vagy tagja ennek a csoportnak." |
| NOT_A_MEMBER (appoint) | validation | "Koordinátor csak a csoport tagja lehet. Kérd meg a szülőt, hogy előbb csatlakozzon a csoporthoz." |
| ALREADY_COORDINATOR | conflict | "Ő már koordinátora ennek a csoportnak." |
| NOT_COORDINATOR | conflict | "Ő már nem koordinátora ennek a csoportnak." |
| ACCOUNT_REQUIRED | validation | "Csak aktív fiókkal rendelkező szülő lehet koordinátor." |
| VERSION_CONFLICT | conflict | "Az oldal közben megváltozott. Frissítsd, és próbáld újra." |
| NOT_A_MEMBER (revoke) | conflict | "Ő már nem tagja ennek a csoportnak." |
| GROUP_UNAVAILABLE | denied | "Ez a munkacsoport nem érhető el." |
| GRANT_USE_COORDINATOR_ACTION | validation | No screen; only a direct request can reach it |
