# Entities: u4-working-groups

The data shape for joining and leaving working groups, seeing members, and appointing and revoking coordinators. Built from `unit-of-work.md` (U4), `unit-of-work-story-map.md`, `stories.md` (US2.1 to US2.3), `requirements.md` (FR2.1, FR2.2, FR2.4, NFR3 to NFR6), `components.md` (WorkingGroups, Identity, Notifications), `contract-summary.md` (C1, C2, C7, C8, C16), ADR-008 and ADR-010 in `decisions.md`, the U1 and U3 entity models this unit extends, and the owner's answers in `functional-design-questions.md`. Contains no names or contact details.

Only what this unit changes or adds is listed. WorkingGroup, Parent, ParentProfile and Account keep the shape U1 and U3 gave them.

## Entity Model

```yaml
entities:
  - name: WorkingGroupMembership
    description: One parent's membership of one working group. U1 created the structure; U4 adds joining, leaving, a version for outdated-screen checks and the reason a membership ended.
    owner: WorkingGroups
    change: version and endReason are new; joining and leaving now write it
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: workingGroupId, type: reference, required: true, references: WorkingGroup }
      - { name: parentId, type: reference, required: true, references: Parent }
      - { name: status, type: enum, required: true, allowed: [active, ended], default: active }
      - { name: joinedAt, type: instant, required: true }
      - { name: endedAt, type: instant, required: false, constraints: [present exactly when status is ended] }
      - { name: endReason, type: enum, required: false, allowed: [left, removed], constraints: [present exactly when status is ended] }
      - { name: version, type: integer, required: true, min: 1, default: 1, constraints: [goes up by one when the membership ends, and when its parent is appointed or revoked as coordinator of its group] }
    constraints:
      - A parent has at most one active membership of a working group (unchanged from U1). Ended ones stay as history.
      - The parent and the working group belong to the same community.
      - Leaving and joining again creates a new membership row; an ended row never becomes active again.
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: WorkingGroupMembership to WorkingGroup }
      - { to: Parent, cardinality: many-to-one, direction: WorkingGroupMembership to Parent }

  - name: RoleGrant
    description: The group-admin grant is the only record of who coordinates a group (U1 entities.md). U4 changes no attribute; it changes who may write a group-admin grant.
    owner: Identity
    change: unchanged shape; a group-admin grant is now written only through the coordinator actions of this unit
    attributes:
      - { name: role, type: enum, required: true, allowed: [parent, kindergarten_teacher, group_admin, super_admin] }
      - { name: scopeType, type: enum, required: true, allowed: [family, group, organization] }
      - { name: scopeId, type: identifier, required: true }
      - { name: revokedAt, type: instant, required: false }
    constraints:
      - An unrevoked group-admin grant on a group exists only while its parent has an active membership of that group. Every writer that ends a membership ends the grant first, including the family-lifecycle step (BR41.8).
      - The role.revoke audit detail names why the grant ended: revoked, left_group or removed (BR40.5).
      - An account holds at most one unrevoked grant for the same role and scope (unchanged).
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: RoleGrant to WorkingGroup, note: id only, checked inside functions (ADR-010) }

  - name: NoticeTarget
    description: A row of U5's notice-target registry. U4 adds the working group as something a notice can point to.
    owner: Notifications
    change: one new value, added by U4 under the additive rule of contract-summary.md
    attributes:
      - { name: targetType, type: text, required: true, unique: true, allowed: [working_group] }
      - { name: factsFunction, type: text, required: true }
      - { name: addedBy, type: text, required: true, allowed: [u4-working-groups] }
    constraints:
      - The facts for a working group are its name and the path of its page. They name no person or family.

  - name: NoticeKind
    description: Rows of U5's notice-kind registry. U4 adds the two coordinator notices. Each sends one in-app notice and one queued email, as every U5 notice does (Q4, Q5).
    owner: Notifications
    change: two new values, added by U4
    attributes:
      - { name: kind, type: text, required: true, unique: true, allowed: [coordinator_appointed, coordinator_revoked] }
      - { name: targetType, type: text, required: true, allowed: [working_group] }
      - { name: titlePrefix, type: text, required: true, allowed: ["Koordinátor lettél:", "Megszűnt a koordinátori jogod:"] }
      - { name: label, type: text, required: true, allowed: ["Koordinátori kinevezés", "Koordinátori jog visszavonása"] }
      - { name: addedBy, type: text, required: true, allowed: [u4-working-groups] }
    constraints:
      - Written by migration files only, as for every registry row (U5).
      - A notice's once key is <kind>:<grant id>, so the appointment and the revocation of the same grant are two notices (BR41.6).

  - name: GroupMemberView
    description: One row of a group's member list as returned to one viewer. Not stored; built on every read under the directory rules of U3 (ADR-008).
    owner: WorkingGroups
    change: new read shape
    attributes:
      - { name: membershipId, type: reference, required: true, references: WorkingGroupMembership }
      - { name: parentId, type: reference, required: true, references: Parent }
      - { name: fullName, type: text, required: true, constraints: [from the display-name rule of C6] }
      - { name: phone, type: text, required: false, constraints: [present only when the directory would show it to this viewer] }
      - { name: email, type: text, required: false, constraints: [present only when the directory would show it to this viewer] }
      - { name: isCoordinator, type: boolean, required: true }
      - { name: isSelf, type: boolean, required: true }
      - { name: version, type: integer, required: false, constraints: [present only for a super admin, who needs it to appoint or revoke] }
    constraints:
      - Never carries residence, occupation, hobby, how-I-support, sharing choice or children.
```

## Summary

| Entity | Change in this unit |
|---|---|
| WorkingGroupMembership | Joining and leaving write it; adds `version` and `endReason`. Rejoining creates a new row. |
| RoleGrant | Same shape. A group-admin grant exists only alongside an active membership, and only U4's coordinator actions write one. |
| NoticeTarget, NoticeKind | U5's registries gain `working_group` and the two coordinator notices. |
| GroupMemberView | The member-list row: name for everyone, phone and email only where the directory allows, the coordinator label. Not stored. |

**Why the membership carries the version for coordinator changes.** The coordinator fact lives on the grant (U1), which has no version, and the group's own version would make unrelated appointments in one group refuse each other. The member row is what the admin sees and acts on, so its version changing on appoint and revoke gives the outdated-screen check one place to look.
