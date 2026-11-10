# Entities: u1-community-foundation

The data shape after one community replaces kindergarten groups. Built from `unit-of-work.md` (U1), `unit-of-work-story-map.md`, `stories.md` (US1.1 to US1.3, US19.1), `requirements.md` (FR1, FR19, NFR3), `components.md` (Identity, Community, WorkingGroups) and `contract-summary.md` (C1, C2, C6). Decisions are ADR-001, ADR-009 and ADR-010 in `decisions.md`, and the answers in `functional-design-questions.md`. Contains no names or contact details.

Only what this unit changes or adds is listed. Family, Parent, ParentProfile and Child keep their shape here; U2 and U3 extend them.

## Entity Model

```yaml
entities:
  - name: Community
    description: The one parent community. The existing organization record, unchanged. Everything not owned by a working group belongs to it.
    owner: Community
    change: unchanged
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: name, type: text, required: true, min: 1, max: 200 }
      - { name: status, type: enum, required: true, allowed: [active, archived], default: active }

  - name: SchoolYear
    description: A school year. Existing record; U2 adds break weeks and the changeover date.
    owner: Community
    change: unchanged
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: name, type: text, required: true, min: 1, max: 100, constraints: [unique within the community, ignoring case] }
      - { name: startsOn, type: date, required: true }
      - { name: endsOn, type: date, required: true, constraints: [not before startsOn] }
      - { name: status, type: enum, required: true, allowed: [active, archived], default: active }

  - name: WorkingGroup
    description: A working group delegated for one school year. Replaces the kindergarten group record.
    owner: WorkingGroups
    change: converted from the kindergarten group; description is new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: schoolYearId, type: reference, required: true, references: SchoolYear }
      - { name: name, type: text, required: true, min: 1, max: 100 }
      - { name: description, type: text, required: true, min: 1, max: 1000 }
      - { name: status, type: enum, required: true, allowed: [active, archived], default: active }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - The name is unique within a school year, ignoring case.
      - The school year belongs to the same community.
    relationships:
      - { to: SchoolYear, cardinality: many-to-one, direction: WorkingGroup to SchoolYear }
      - { to: WorkingGroupMembership, cardinality: one-to-many, direction: WorkingGroupMembership to WorkingGroup }

  - name: WorkingGroupMembership
    description: One parent's membership of one working group. Replaces the family's group membership. U1 creates the structure only; joining and leaving arrive in U4.
    owner: WorkingGroups
    change: converted; the member is now a parent, not a family
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: workingGroupId, type: reference, required: true, references: WorkingGroup }
      - { name: parentId, type: reference, required: true, references: Parent }
      - { name: status, type: enum, required: true, allowed: [active, ended], default: active }
      - { name: joinedAt, type: instant, required: true }
      - { name: endedAt, type: instant, required: false, constraints: [present exactly when status is ended] }
    constraints:
      - A parent has at most one active membership of a working group. An ended one stays as history.
    relationships:
      - { to: WorkingGroup, cardinality: many-to-one, direction: WorkingGroupMembership to WorkingGroup }
      - { to: Parent, cardinality: many-to-one, direction: WorkingGroupMembership to Parent }

  - name: RoleGrant
    description: A right held by an account. The group-admin right now names a working group, and the teacher right names the community.
    owner: Identity
    change: allowed role and scope pairs change
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: accountId, type: reference, required: true, references: Account }
      - { name: role, type: enum, required: true, allowed: [parent, kindergarten_teacher, group_admin, super_admin] }
      - { name: scopeType, type: enum, required: true, allowed: [family, group, organization] }
      - { name: scopeId, type: identifier, required: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: revokedAt, type: instant, required: false }
    constraints:
      - parent pairs only with family.
      - group_admin pairs only with group, which now names a working group.
      - kindergarten_teacher pairs only with organization, which is the community.
      - super_admin pairs only with organization.
      - An account holds at most one unrevoked grant for the same role and scope.
    relationships:
      - { to: Account, cardinality: many-to-one, direction: RoleGrant to Account }
      - { to: WorkingGroup, cardinality: many-to-one, direction: RoleGrant to WorkingGroup, note: id only, checked inside functions (ADR-010) }

  - name: Invitation
    description: A single-use invitation. It no longer carries the group-admin role, and a teacher invitation names the community.
    owner: Identity
    change: allowed role and scope pairs change
    attributes:
      - { name: role, type: enum, required: true, allowed: [parent, kindergarten_teacher, super_admin] }
      - { name: scopeType, type: enum, required: true, allowed: [family, organization] }
      - { name: scopeId, type: identifier, required: true }
    constraints:
      - parent pairs only with family.
      - kindergarten_teacher and super_admin pair only with organization.

  - name: Event
    description: An existing event. Its working group becomes optional.
    owner: Events
    change: workingGroupId becomes optional; no group means community-wide
    attributes:
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup }
    constraints:
      - When present, the working group is in the same community.

  - name: DutyTask
    description: Today's task record, which U2 moves into the Duty model. Its working group becomes optional.
    owner: Duties
    change: workingGroupId becomes optional; no group means community-wide
    attributes:
      - { name: workingGroupId, type: reference, required: false, references: WorkingGroup }
      - { name: eventId, type: reference, required: false, references: Event }
    constraints:
      - A task of an event has the same working group as the event, and no group when the event has none.
```

## Summary

| Entity | Change in this unit |
|---|---|
| Community, SchoolYear | Unchanged. Community is the existing organization record. |
| WorkingGroup | The kindergarten group, converted, with a required description. |
| WorkingGroupMembership | Membership moves from the family to the parent. |
| RoleGrant | `group_admin` names a working group; `kindergarten_teacher` names the community. |
| Invitation | Cannot carry `group_admin`; a teacher invitation names the community. |
| Event, DutyTask | Working group is optional. None means community-wide. |

**One source for who coordinates a group.** `components.md` lists `isCoordinator` on the membership, and ADR-010 keeps role grants in Identity. Storing both would give two copies of one fact, so the unrevoked `group_admin` RoleGrant is the only record of it. U4's `group_coordinators` reads the grant.

**Removed with the old import (FR19):** ImportRun, ImportRow, ImportStagedRow, ImportConflict and SheetRegistry, and the `import` value of a place's source.
