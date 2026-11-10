# Business Rules: u1-community-foundation

Built from `unit-of-work.md` (U1), `unit-of-work-story-map.md`, `stories.md` (US1.1 to US1.3, US19.1), `requirements.md`, `components.md`, `contract-summary.md` (C1, C2, C6, C18), `decisions.md` and `functional-design-questions.md`. Every rule is enforced on the database side. Screens only present the outcome. Contains no names or contact details.

## Rules

```yaml
rules:
  - id: BR1.1
    statement: A rota, community event, directory entry or book belongs to the community and to no working group.
    category: constraint
    applies_to: [Event, DutyTask, Family, Parent]
    trigger: creating such a record
    logic: IF the record is community-owned THEN it carries the community and no working group. Family, Parent, rota and book records have no working-group attribute at all.
    violation: The record cannot be stored with a group.
    source: FR1.2, AC1.1.1
  - id: BR1.2
    statement: A working-group event or task belongs to exactly one active working group of the same community.
    category: validation
    applies_to: [Event, DutyTask]
    trigger: saving an event or task that names a group
    logic: IF a group is named THEN it must exist in the caller's community and be active.
    violation: Validation refusal naming the group field; nothing is stored.
    source: FR1.3, AC1.1.2
  - id: BR1.3
    statement: A task of an event has the event's scope.
    category: constraint
    applies_to: [DutyTask]
    trigger: saving a task that names an event
    logic: IF the task names an event THEN its working group equals the event's, and both are empty for a community event. The database compares them on every write, including when either is empty, because a composite key is not checked on an empty value.
    violation: Validation refusal on the event field; a direct write is refused by the database.
    source: FR1.2, FR1.3
  - id: BR1.4
    statement: The structure change starts clean.
    category: policy
    applies_to: [WorkingGroup, WorkingGroupMembership, RoleGrant, Invitation, Event, DutyTask, Family, Parent, Child]
    trigger: applying the structure change
    logic: The change deletes every record listed in step 2 of W1 in functional-spec.md, including families, parents, invitations, notices, reminders and every grant except super admin, in the same step that changes the structure. Communities, school years, accounts, super-admin grants, settings and the audit log stay. Fresh invented data is then loaded after a reset.
    violation: The whole change rolls back and the database stays as it was.
    source: FR1.1, AC1.1.3
  - id: BR1.5
    statement: A family has no working group.
    category: constraint
    applies_to: [Family, WorkingGroupMembership]
    trigger: any membership write
    logic: Membership is held per parent. No rule may derive a family's rights from a group.
    violation: Not representable.
    source: FR2.1, ADR-001

  - id: BR2.1
    statement: A fresh install for 2026-2027 holds the six working groups.
    category: policy
    applies_to: [WorkingGroup]
    trigger: loading the starting data
    logic: Játszókert, Karbantartó, Ünnep-előkészítő, Kreatív-alkotó, Nagytakarítás szervezése and Állatgondozás are each created with a name, a description and the 2026-2027 school year. Loading twice creates no duplicates.
    violation: Loading stops with the name of the failed group.
    source: FR1.4, AC1.2.1
  - id: BR2.2
    statement: A working group needs a description and a name unique within its school year.
    category: validation
    applies_to: [WorkingGroup]
    trigger: creating or editing a working group
    logic: IF the description is empty or over 1000 characters, or the name is already used in that year ignoring case, THEN refuse.
    violation: Validation refusal naming the field.
    source: FR1.4
  - id: BR2.3
    statement: Every signed-in role reads the active working groups.
    category: authorization
    applies_to: [WorkingGroup]
    trigger: opening the working-group list
    logic: IF the caller has an active session and a current role in the community THEN return each active group's name, description and school year, ordered by school year (newest first), then name, then id.
    violation: Denied refusal, never an empty list.
    source: FR2.4, AC1.2.1, C1, C2
  - id: BR2.4
    statement: A signed-out visitor sees no working-group data.
    category: authorization
    applies_to: [WorkingGroup]
    trigger: opening the list without a session
    logic: The visitor is sent to sign-in. The database returns nothing to an unauthenticated caller.
    violation: Redirect to sign-in.
    source: AC1.2.2
  - id: BR2.5
    statement: Only a super admin creates, edits, archives or restores a working group.
    category: authorization
    applies_to: [WorkingGroup]
    trigger: any working-group write
    logic: IF the caller is not a super admin THEN refuse, including a group's own administrator.
    violation: Denied refusal with no change.
    source: FR1.5, C2

  - id: BR3.1
    statement: Each role pairs with one kind of scope.
    category: constraint
    applies_to: [RoleGrant]
    trigger: writing a grant
    logic: parent with family; group_admin with working group; kindergarten_teacher with community; super_admin with community.
    violation: Validation refusal; the database also refuses any other pair.
    source: FR1.5, FR1.6
  - id: BR3.2
    statement: Managing a group requires a super admin, or an unrevoked group-admin grant on that group held by an active parent.
    category: authorization
    applies_to: [RoleGrant, WorkingGroup]
    trigger: every check of can_manage_group
    logic: IF the session is active AND (the caller is a super admin OR (a group-admin grant on that group is unrevoked AND the account's linked parent and family are active)) THEN true, otherwise false.
    violation: Returns false. A stale link never grants access.
    source: FR1.5, C2, ADR-010
  - id: BR3.3
    statement: A group administrator may act on the events, tasks, assignments and approvals of every group they hold.
    category: authorization
    applies_to: [Event, DutyTask]
    trigger: any admin command or admin read on a group's item
    logic: IF can_manage_group holds for the item's group THEN allowed. An administrator of several groups reaches all of them and no others.
    violation: See BR3.4.
    source: FR1.5, AC1.3.1
  - id: BR3.4
    statement: A group administrator cannot reach another group's items or community-wide items as an administrator.
    category: authorization
    applies_to: [Event, DutyTask]
    trigger: an admin command or admin read naming such an item, from the screen or directly
    logic: IF can_manage_group is false for the item's group, or the item has no group and the caller is not a super admin, THEN refuse. The refusal does not reveal whether the item exists.
    violation: Denied refusal with no change; the attempt is audited as today.
    source: FR2.3, AC1.3.2, NFR3
  - id: BR3.5
    statement: Community-wide events and tasks are created and managed only by a super admin.
    category: authorization
    applies_to: [Event, DutyTask]
    trigger: saving an event or task with no group
    logic: IF the item has no group and the caller is not a super admin THEN refuse.
    violation: Denied refusal.
    source: FR11.1, C2
  - id: BR3.6
    statement: The group-admin role is given only by a super admin, to an account linked to an active parent, and never through an invitation.
    category: authorization
    applies_to: [RoleGrant]
    trigger: granting group_admin; creating an invitation
    logic: IF the caller is not a super admin THEN refuse. IF the account has no active parent THEN refuse. An invitation may carry parent, kindergarten_teacher or super_admin only.
    violation: Denied or validation refusal; no grant is created. U4 adds the membership condition through grant_admin.
    source: FR2.2, C2
  - id: BR3.7
    statement: A teacher reads the whole community's schedule and working groups and changes nothing.
    category: authorization
    applies_to: [DutyTask, Event, WorkingGroup]
    trigger: any teacher read or write
    logic: IF the caller holds an unrevoked teacher grant THEN every working-group and community-wide schedule entry is readable, as today's display-name fields only. Every write is refused.
    violation: Denied refusal.
    source: FR1.6, AC1.3.3
  - id: BR3.8
    statement: Only a super admin invites or grants a teacher.
    category: authorization
    applies_to: [RoleGrant]
    trigger: inviting or granting a teacher
    logic: IF the caller is not a super admin THEN refuse.
    violation: Denied refusal.
    source: FR1.6, C2
  - id: BR3.9
    statement: Only a super admin manages or reads families, parents, children and their contact details as an administrator.
    category: authorization
    applies_to: [Family, Parent, Child]
    trigger: any record command or read outside a parent's own family
    logic: IF the caller is not a super admin THEN refuse. A parent keeps reading their own family.
    violation: Denied refusal. The Nyilvántartások menu item is absent for group administrators.
    source: FR3.7, Q1 of functional-design-questions.md, C2
  - id: BR3.10
    statement: A group administrator sees family names only, where a task needs them.
    category: authorization
    applies_to: [Family]
    trigger: assigning a family; reading a task's places or an approval
    logic: Active families are listed by id and display name through C6's name rule. No contact detail, child or profile field is returned.
    violation: Denied refusal for a caller with no administrator role.
    source: Q1 of functional-design-questions.md, C6, ADR-008
  - id: BR3.11
    statement: A revoked right applies at the next request.
    category: authorization
    applies_to: [RoleGrant]
    trigger: revoking a grant; ending a parent or family
    logic: Every check reads current grants and current parent status. Nothing is cached across requests.
    violation: The next request is denied.
    source: NFR3, C2
  - id: BR3.12
    statement: Every role grant and revocation is audited.
    category: policy
    applies_to: [RoleGrant]
    trigger: a successful grant or revocation
    logic: One audit event records the action, the actor and the target, with no name or contact detail.
    violation: The change rolls back when the audit event cannot be written.
    source: NFR4, C1
  - id: BR3.13
    statement: A caller with no current family is refused by every family-based command.
    category: authorization
    applies_to: [DutyTask]
    trigger: sign-up, swap, or any command acting for a family
    logic: IF current_family_id is empty THEN return the denied refusal. A teacher and a super admin without a linked parent fall here.
    violation: Denied refusal.
    source: C2

  - id: BR4.1
    statement: Every parent reads and may sign up for any open task in the community, whichever working group owns it.
    category: policy
    applies_to: [DutyTask]
    trigger: listing or signing up for tasks
    logic: The group plays no part in what a family sees or may take. Capacity, timing and version checks stay as today.
    violation: Today's refusal codes for full, closed, stale or already held.
    source: FR2.3, C2, C18
  - id: BR4.2
    statement: An administrator may assign any active family to a task they manage.
    category: authorization
    applies_to: [DutyTask]
    trigger: assigning a family
    logic: IF the caller manages the task (BR3.3 or super admin) AND the family is active THEN allowed. Membership is not checked.
    violation: Denied or validation refusal.
    source: FR1.2, C2
  - id: BR4.3
    statement: A swap does not depend on working groups.
    category: policy
    applies_to: [DutyTask]
    trigger: proposing or confirming a swap
    logic: Two families may swap future places on any two tasks of the community. The same-group and membership conditions of today's swap are removed. U7 adds the rota rules.
    violation: Today's swap refusals for stale, closed or pending places.
    source: FR8.2
  - id: BR4.4
    statement: A group-wide reminder reaches the group's members' families, or every family for a community-wide task.
    category: calculation
    applies_to: [DutyTask]
    trigger: creating reminders under the group recipient setting
    logic: IF the task has a working group THEN the recipients are the active families with at least one parent who is an active member. IF the task has none THEN the recipients are all active families. U5 replaces this mechanism.
    violation: None; an empty recipient list creates no reminder.
    source: FR1.2, FR17.4

  - id: BR5.1
    statement: A person or family is shown by name only, or as "korábbi tag" once removed.
    category: calculation
    applies_to: [Parent, Family]
    trigger: any consumer asking for a display name
    logic: parent_display_name and family_display_name return the name, and "korábbi tag" once the record has the removed status that U14 adds. An archived record keeps its name until then. Neither ever returns a child's name or contact detail.
    violation: None; an unknown id returns nothing.
    source: C6, FR5.6

  - id: BR6.1
    statement: Every new function follows the shared convention.
    category: policy
    applies_to: [WorkingGroup, RoleGrant]
    trigger: adding a database function
    logic: No rights until granted explicitly. A command takes an idempotency key and, when changing a record, an expected version, and returns the result envelope. A repeated key returns the stored result. A list function denies rather than returning an empty list.
    violation: Rejected in review and by the catalogue test.
    source: C1
  - id: BR6.2
    statement: A must-have test case with no meaning for a rule is recorded in the test plan's table.
    category: policy
    applies_to: [WorkingGroup, RoleGrant, Event, DutyTask]
    trigger: writing the fixed-list tests of a rule
    logic: One row per rule and one column per case. Each cell names the test or says "nem értelmezhető" with the reason.
    violation: A blank cell fails the unit's review.
    source: NFR6, C1, Q3 of functional-design-questions.md

  - id: BR7.1
    statement: The old import no longer exists.
    category: policy
    applies_to: [Community]
    trigger: opening the old address; calling an old function
    logic: The address answers "page not found" for everyone, and its screen, parser, database functions and tables are gone. Audit events about past imports stay.
    violation: A remaining function or table fails the catalogue test.
    source: FR19.1, AC19.1.1, ADR-009

  - id: BR8.1
    statement: Someone who is both a parent and an administrator can switch between the two menus.
    category: policy
    applies_to: [RoleGrant]
    trigger: showing the header
    logic: IF the account holds both a working parent link and an administrator role THEN the header shows "Szülői nézet" or "Adminisztráció", leading to the other area's home. Each area still checks its own rights.
    violation: None; the link is absent otherwise.
    source: FR1.5, mockups.md Navigation
```

## Summary

| Group | Rules | What they settle |
|---|---|---|
| Community scope | BR1.1 to BR1.5 | What belongs to the community or a group, and the clean start |
| Working groups | BR2.1 to BR2.5 | The six groups, who reads them, who changes them |
| Roles | BR3.1 to BR3.13 | What each role reaches; every refusal holds when the screen is bypassed |
| Today's duties | BR4.1 to BR4.4 | Sign-up, assignment, swaps and reminders without group membership |
| Display | BR5.1 | Names only, or "korábbi tag" |
| Conventions | BR6.1, BR6.2 | The function convention and how a meaningless test case is recorded |
| Retired import | BR7.1 | Screen, parser, functions and tables gone |
| Navigation | BR8.1 | Switching between parent and administrator menus |

BR4.4 is an assumption of this design: `requirements.md` does not say who a group-wide reminder reaches once a task can be community-wide. It keeps today's setting working until U5 replaces it.
