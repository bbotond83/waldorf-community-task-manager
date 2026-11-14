# Entities: u3-directory-and-profile

The data shape for the parent directory, the sharing choice, a parent's own details, password and email change, adding and removing parents, and invitations. Built from `unit-of-work.md` (U3), `unit-of-work-story-map.md`, `stories.md` (US3.1 to US3.7), `requirements.md` (FR3, NFR1 to NFR5, NFR10), `components.md` (Identity, Community, WebApplication), `contract-summary.md` (C1, C2, C6, C16, C17) and the owner's answers in `functional-design-questions.md` (Q1 to Q7). The visibility decision is ADR-008 in `decisions.md`; the id-only references are ADR-010. Contains no names or contact details.

Only what this unit changes or adds is listed. Community, SchoolYear, WorkingGroup, RoleGrant and the duty records keep the shape U1 and U2 gave them.

**Rule numbers.** The rules of this unit are `BR30.x` to `BR38.x` in `rules.md`. Comments in older database files also cite `BR30.x`; those belong to an earlier piece of work and mean something else.

**Today's records.** Today a parent has one free-text profile, stored only with consent, and a separate contact record (email, phone, locality) that only the family and administrators can read. The records are invented test data (AC1.1.3), so nothing is carried over: the free-text profile is dropped, and "locality" becomes the place of residence. Every piece of existing code that reads or writes those fields is redefined in the same change; the list is under "Existing Code That Changes" in `functional-spec.md`.

## Entity Model

```yaml
entities:
  - name: Parent
    description: A parent of a family. U3 drops the old free-text profile and its consent flag; the sharing choice moves to ParentProfile.
    owner: Community
    change: optionalProfile and optionalProfileConsent removed
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: familyId, type: reference, required: true, references: Family }
      - { name: accountId, type: reference, required: false, unique: true, references: Account, note: id only (ADR-010); empty until an invitation is accepted }
      - { name: displayName, type: text, required: true, min: 1, max: 200, note: the full name; always visible to every signed-in user }
      - { name: status, type: enum, required: true, allowed: [active, archived], default: active, note: archived means removed (BR36) }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A family keeps at least one active parent while the family is active (BR36.2).
    relationships:
      - { to: Family, cardinality: many-to-one, direction: Parent to Family }
      - { to: ParentProfile, cardinality: one-to-one, direction: ParentProfile to Parent }
      - { to: Account, cardinality: one-to-one, direction: Parent to Account, note: optional }

  - name: ParentProfile
    description: A parent's contact and profile details and their sharing choice. Replaces today's contact record. Nothing here is read directly by a screen; every read goes through the directory functions (ADR-008).
    owner: Community
    change: extended from today's contact record
    attributes:
      - { name: parentId, type: reference, required: true, unique: true, references: Parent }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: emailOnRecord, type: email, required: false, max: 254, constraints: [lower case], note: the address the administrator entered; used for the invitation and shown while the parent has no account (BR30.6) }
      - { name: phone, type: text, required: false, constraints: [phone format, BR32.2] }
      - { name: residence, type: text, required: false, max: 100, note: place of residence, today's locality }
      - { name: occupation, type: text, required: false, max: 100 }
      - { name: hobby, type: text, required: false, max: 200 }
      - { name: howISupport, type: text, required: false, max: 500, note: how the parent supports the community }
      - { name: sharingConsent, type: boolean, required: true, default: false }
      - { name: consentChangedAt, type: instant, required: false, note: time of the last change of sharingConsent; empty while it was never changed }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A parent counts as shared only when sharingConsent is true and the parent is active and linked to an active account; deactivating the account also sets sharingConsent to false (BR31.5).
      - Unticking keeps every field (owner answer Q4); removal clears them (BR36.3).
      - Empty text is stored as absent, so "cleared" and "never filled" are the same.
    relationships:
      - { to: Parent, cardinality: one-to-one, direction: ParentProfile to Parent }

  - name: Family
    description: Unchanged in shape. Removing a family archives it, as today.
    owner: Community
    change: none
    attributes:
      - { name: status, type: enum, required: true, allowed: [active, archived] }
    relationships:
      - { to: Parent, cardinality: one-to-many, direction: Parent to Family }
      - { to: Child, cardinality: one-to-many, direction: Child to Family }

  - name: Child
    description: Unchanged in shape. Its name is shown only under BR30.4.
    owner: Community
    change: none
    attributes:
      - { name: displayName, type: text, required: true, min: 1, max: 200 }
      - { name: status, type: enum, required: true, allowed: [active, archived] }
    relationships:
      - { to: Family, cardinality: many-to-one, direction: Child to Family }

  - name: Account
    description: Unchanged in shape. Its email is the sign-in email; it changes only through a confirmed EmailChangeRequest.
    owner: Identity
    change: none
    attributes:
      - { name: email, type: email, required: true, unique: true, max: 254, constraints: [lower case] }
      - { name: status, type: enum, required: true, allowed: [active, deactivated] }
    relationships:
      - { to: EmailChangeRequest, cardinality: one-to-many, direction: EmailChangeRequest to Account }

  - name: EmailChangeRequest
    description: A parent's request to change their sign-in email to a new address, waiting for the link sent to that address to be opened.
    owner: Identity
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: accountId, type: reference, required: true, references: Account }
      - { name: newEmail, type: email, required: true, max: 254, constraints: [lower case, differs from the account's current email] }
      - { name: tokenHash, type: text, required: true, unique: true, note: only the hash is stored; the token appears once, in the emailed link }
      - { name: status, type: enum, required: true, allowed: [pending, confirmed, cancelled, replaced], default: pending }
      - { name: createdAt, type: instant, required: true }
      - { name: expiresAt, type: instant, required: true, note: createdAt plus 24 hours (owner answer Q6) }
      - { name: decidedAt, type: instant, required: false, constraints: [present exactly when status is not pending] }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - At most one pending request per account (BR34.3).
      - A pending request past expiresAt is expired. It is read as expired, never confirmed, and is not counted as pending; no job is needed to mark it.
    relationships:
      - { to: Account, cardinality: many-to-one, direction: EmailChangeRequest to Account }

  - name: Invitation
    description: Unchanged in shape from U1. U3 adds the state shown on the administrator's parent page.
    owner: Identity
    change: none
    attributes:
      - { name: status, type: enum, required: true, allowed: [pending, accepting, accepted, revoked, replaced] }
      - { name: expiresAt, type: instant, required: true, note: 7 days after it was sent }
    relationships:
      - { to: Parent, cardinality: many-to-one, direction: Invitation to Parent, note: id only (ADR-010) }

  - name: DirectoryCard
    description: What one viewer may see of one family. It is computed for each read and never stored. Fields a viewer may not see are absent, not empty (ADR-008).
    owner: Community
    change: new, read model
    attributes:
      - { name: familyId, type: reference, required: true, references: Family }
      - { name: familyName, type: text, required: true }
      - { name: parents, type: list, required: true, note: one entry per active parent, each with parentId and fullName and only the further fields BR30 allows }
      - { name: children, type: list, required: false, note: present only when BR30.4 allows; absent when the family has no children }
      - { name: isOwnFamily, type: boolean, required: true }
    constraints:
      - Built only by the directory read functions; no table holds it.
    relationships:
      - { to: Family, cardinality: one-to-one, direction: DirectoryCard to Family }
```

## Audit Records

Platform's AuditEvent keeps its shape. U3 adds these actions; each records the actor's account id, the target's id and the time, never a field value (NFR1, NFR4).

| Action | Written when |
|---|---|
| `profile.sharing_changed` | A parent ticks or unticks sharing; carries the new value (true or false) |
| `account.password_changed` | A parent changes their password |
| `account.email_change_requested` | A parent asks for an email change |
| `account.email_changed` | A change is confirmed |
| `parent.added`, `family.added` | An administrator adds a parent or a family |
| `parent.removed` | An administrator removes a parent |
| `invitation.sent` | An invitation or a new one replacing it is sent (today's event, kept) |

## Summary

| Entity | Change | Purpose |
|---|---|---|
| Parent | Old profile text and flag removed | The person in a family |
| ParentProfile | Extended from the contact record | Contact details, the four profile fields and the sharing choice |
| Family, Child | None | Read under the new rules |
| Account | None | Its email changes only through a confirmed request |
| EmailChangeRequest | New | A pending sign-in email change with its 24-hour link |
| Invitation | None | State shown on the parent page |
| DirectoryCard | New, computed | What one viewer may see of one family |
