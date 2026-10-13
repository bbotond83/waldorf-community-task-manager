# Entities: U2 Identity and access

The records U2 owns. Source: `components.md` (Identity, Access), ADR-004, ADR-007, ADR-009, the existing `app_role_grants` and `app_authorization_versions` tables and the current-roles migration, requirements FR2.1 to FR2.5 and FR3.3, the confirmed answers in `functional-design-questions.md` (Q1 to Q8), and the first review of this design. Conventions from U1 apply (uuid keys, scope columns, version, timestamps).

Session model in one sentence: the sign-in service's own session is the session; the database accepts a request only when its token's session is still active in the sign-in service's session table and the account is active (rules BR2.5 to BR2.7). There is no separate app session table.

```yaml
entities:
  - name: Account
    owner: Identity
    description: "The app's mirror of one sign-in user; its id equals the sign-in user's id. Credentials stay in the sign-in service."
    attributes:
      - { name: id, type: uuid, required: true, unique: true, constraints: "equal to the sign-in user's id, not generated here (the one recorded exception to the U1 convention of a database-generated uuid default, because the sign-in service owns the id)" }
      - { name: email, type: text, required: true, unique: true, constraints: "lower-cased; personal data, readable only by the account itself and by admins within reach" }
      - { name: organization_id, type: uuid, required: true, constraints: "the organization the account belongs to (from the invitation, the operator command or the seed); gives admins a reach for accounts that hold no grant yet and gives account.deactivate and account.reactivate their audit organization" }
      - { name: status, type: text, required: true, allowed: [active, deactivated], default: active }
      - { name: created_at, type: timestamp, required: true, default: "now (UTC)" }
      - { name: updated_at, type: timestamp, required: true, default: "now (UTC)" }
      - { name: version, type: integer, required: true, default: 1 }
    constraints:
      - "no references to any other block (Directory's Parent and Access's grants refer to Account)"
      - "no insert, update or delete by application roles; only the named functions change it"
  - name: Invitation
    owner: Identity
    description: "An admin's invitation for one email address, role and scope"
    attributes:
      - { name: id, type: uuid, required: true, unique: true, default: "database-generated" }
      - { name: email, type: text, required: true, constraints: "lower-cased" }
      - { name: role, type: text, required: true, allowed: [parent, kindergarten_teacher, group_admin, super_admin] }
      - { name: scope_type, type: text, required: true, allowed: [family, group, organization] }
      - { name: scope_id, type: uuid, required: true, constraints: "typed unconstrained reference to the family, group or organization" }
      - { name: organization_id, type: uuid, required: true }
      - { name: target_id, type: uuid, required: false, constraints: "typed unconstrained reference to the Parent the invitation is for, when one exists (linked in U3)" }
      - { name: token_hash, type: text, required: true, unique: true, constraints: "hash of a 32-byte random token; the token is shown once in the link; this column is never selectable by application roles" }
      - { name: status, type: text, required: true, allowed: [pending, accepting, accepted, revoked, replaced], default: pending, constraints: "accepting means one acceptance holds a reservation (BR2.11)" }
      - { name: reserved_at, type: timestamp, required: false, constraints: "set when status becomes accepting; a reservation older than 2 minutes is released back to pending" }
      - { name: created_by_account_id, type: uuid, required: true, references: "Account" }
      - { name: created_at, type: timestamp, required: true, default: "now (UTC)" }
      - { name: expires_at, type: timestamp, required: true, default: "created_at plus 7 days" }
      - { name: accepted_at, type: timestamp, required: false }
      - { name: accepted_account_id, type: uuid, required: false, references: "Account" }
      - { name: replaces_invitation_id, type: uuid, required: false, references: "Invitation" }
      - { name: version, type: integer, required: true, default: 1 }
    constraints:
      - "role and scope pairs follow the same pairing as RoleGrant"
      - "at most one open invitation (pending or accepting) per (email, role, scope_type, scope_id), enforced by a partial unique index on status pending or accepting; because expiry is not part of an index, the create function first marks an expired pending invitation for the same key as replaced"
      - "expired is derived (pending with expires_at in the past), never stored"
  - name: RoleGrant
    owner: Access
    description: "One role with one scope held by one account; extends the existing app_role_grants table"
    attributes:
      - { name: id, type: uuid, required: true, unique: true, default: "database-generated", constraints: "the existing table has no default; U2's migration adds gen_random_uuid() to follow the U1 convention" }
      - { name: subject_id, type: uuid, required: true, references: "Account", constraints: "the existing column name is kept" }
      - { name: role, type: text, required: true, allowed: [parent, kindergarten_teacher, group_admin, super_admin], constraints: "these are the values the existing current_role_scope constraint allows; the old kindergarten_admin and read_only_staff values exist only in data already converted by the current-roles migration" }
      - { name: scope_type, type: text, required: true, allowed: [family, group, organization] }
      - { name: scope_id, type: uuid, required: true }
      - { name: organization_id, type: uuid, required: true }
      - { name: granted_by_account_id, type: uuid, required: false, constraints: "empty only for the first super admin and the seed (system actor)" }
      - { name: granted_at, type: timestamp, required: true, default: "now (UTC)" }
      - { name: revoked_at, type: timestamp, required: false }
    constraints:
      - "pairs (existing constraint): parent with family, kindergarten_teacher and group_admin with group, super_admin with organization where scope_id equals organization_id"
      - "an account may hold several grants"
    relationships:
      - { to: Account, cardinality: "many to one", direction: "RoleGrant refers to Account" }
  - name: AuthorizationVersion
    owner: Access
    description: "One counter per account that increases on every grant change, deactivation and reactivation; extends the existing app_authorization_versions table"
    attributes:
      - { name: subject_id, type: uuid, required: true, unique: true, references: "Account" }
      - { name: authorization_version, type: integer, required: true, default: 1, constraints: "positive (existing constraint)" }
  - name: SignInAttempt
    owner: Identity
    description: "One wrong-password attempt made through the app's sign-in screen, kept to apply the lockout"
    attributes:
      - { name: id, type: uuid, required: true, unique: true, default: "database-generated" }
      - { name: email_hash, type: text, required: true, constraints: "keyed hash (HMAC with the session secret) of the lower-cased email, so the table cannot be reversed by guessing addresses" }
      - { name: attempted_at, type: timestamp, required: true, default: "now (UTC)" }
    constraints:
      - "no access by application roles at all; written and read only by the sign-in attempt functions"
      - "rows older than 15 minutes are removed by the housekeeping function"
      - "at most 20 rows per email hash are kept"
```

## Access Rules per Entity (Row-Level Security)

| Entity | Read | Write |
|---|---|---|
| Account | The account itself; a group admin for accounts holding a grant in their group; a super admin for accounts whose organization_id is theirs. Never another parent | Named functions only |
| Invitation | Admins who may invite for that scope (created by them or within their reach); the token hash column is excluded for everyone | Named functions only |
| RoleGrant | The account's own active grants (existing policy); admins within reach | Named functions only (existing: no client writes) |
| AuthorizationVersion | The account's own row (existing policy) | Named functions only |
| SignInAttempt | Nobody | Named functions only |

Every policy and every elevated function also requires the request's session to be active and the account to be active (BR2.5, BR2.6). That includes the two existing self-read policies on the grants and version tables (`current_grants_self`, `current_version_self`), which U2's migration replaces with versions that call `current_session_is_active()`. The sign-in service's service-role key has no table rights on any U2 table and may execute only the functions named for it (BR2.23).

## Summary

Identity owns Account, Invitation and SignInAttempt. Access owns RoleGrant and AuthorizationVersion (both extending existing tables) and the policy functions and tests. Credentials, password hashes, reset tokens and sessions stay in the sign-in service and are never copied. Audit events and idempotency records are U1's; U2 calls them and extends the audit action list with account.deactivate and account.reactivate (BR2.14).

Existing objects: the grants and version tables keep their names. The older `app_audit_events` table from the first migration is superseded by U1's audit log; U2's migration drops it only after a catalogue test lists no function, policy or code that references it (BR2.22).
