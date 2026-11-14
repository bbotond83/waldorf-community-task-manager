# Business Rules: u3-directory-and-profile

Built from `unit-of-work.md` (U3), `unit-of-work-story-map.md`, `stories.md` (US3.1 to US3.7), `requirements.md` (FR3, NFR1 to NFR5, NFR10), `components.md`, `contract-summary.md` (C1, C2, C6, C16, C17), `decisions.md` (ADR-008, ADR-010) and `functional-design-questions.md` (Q1 to Q7). Every rule is enforced on the database side, except where a rule says the sign-in service checks a password. Screens only present the outcome. Refusal codes are the stable `code` of the C1 result envelope. Contains no names or contact details.

"Super admin" means the community administrator (C2 `has_community_admin`). A working-group coordinator has no extra directory rights: they see what a parent sees (FR3.5).

## Rules

```yaml
rules:
  # --- Directory reads (ADR-008) -----------------------------------------------------
  - id: BR30.1
    statement: Every signed-in user of the community can open the directory; nobody else can.
    category: authorization
    applies_to: [DirectoryCard]
    trigger: reading the directory or one family's card
    logic: IF the caller has an active session in the community (C2 can_read_community) THEN return one card per active family. Otherwise return a denied refusal, never an empty list (C1).
    violation: Denied refusal; no row is returned.
    source: FR3.1, NFR3
  - id: BR30.2
    statement: A parent who has not shared is shown to other parents by full name only.
    category: authorization
    applies_to: [DirectoryCard, ParentProfile]
    trigger: a parent, including a coordinator, reads the directory
    logic: IF the viewer is not a teacher or super admin AND the shown parent is not the viewer AND the shown parent does not count as shared (BR31.5) THEN the parent's entry carries only the full name. This holds for the other parent of the viewer's own family too (owner answer Q2). The family name is always shown.
    violation: Not applicable; the hidden fields are absent from the result and never leave the database.
    source: FR3.3, AC3.1.2, AC3.1.5, AC3.2.3, owner answer Q2 (A)
  - id: BR30.3
    statement: A parent who has shared is shown to other parents with name, phone, email, place of residence, occupation, hobby and how they support the community.
    category: authorization
    applies_to: [DirectoryCard, ParentProfile]
    trigger: any signed-in user reads the directory
    logic: IF the shown parent counts as shared (BR31.5) THEN the entry carries the full name, the email shown under BR30.6, and every profile field that is filled. A field that is not filled is absent.
    violation: Not applicable.
    source: FR3.3, FR3.4, AC3.1.1, AC3.2.2
  - id: BR30.4
    statement: A family's children are shown only when every active parent of the family has shared.
    category: authorization
    applies_to: [DirectoryCard, Child]
    trigger: any viewer except a super admin reads a family
    logic: IF the viewer belongs to the family THEN its children are shown. OTHERWISE IF the family has at least one active parent AND every active parent counts as shared (BR31.5) THEN the active children's names are shown. A parent without an account, or with a deactivated one, counts as not shared. Teachers follow the same rule (owner answer Q3). IF the family has no active child THEN no children section is returned at all. Nothing in the result says why children are missing.
    violation: Not applicable; the names are absent.
    source: FR3.3, FR3.9, AC3.1.3, AC3.1.4, AC3.1.6, AC3.1.7, AC3.1.8, owner answer Q3 (A)
  - id: BR30.5
    statement: A teacher always sees every parent's name, phone and email; the other profile fields follow the sharing choice.
    category: authorization
    applies_to: [DirectoryCard, ParentProfile]
    trigger: a teacher reads the directory
    logic: IF the viewer is a kindergarten teacher THEN every parent entry carries the full name, phone and email (BR30.6), whether or not the parent shared or has an account. Residence, occupation, hobby and how they support follow BR30.2 and BR30.3. Children follow BR30.4.
    violation: Not applicable.
    source: FR3.5, AC3.5.1, assumption A3 in requirements.md
  - id: BR30.6
    statement: The directory shows one email per parent, the sign-in email once the parent has an account.
    category: calculation
    applies_to: [ParentProfile, Account]
    trigger: building a parent entry that may carry the email
    logic: IF the parent has a linked active account THEN the email shown is the account's sign-in email. OTHERWISE it is emailOnRecord. A pending, unconfirmed new address is never shown to others.
    violation: Not applicable.
    source: FR3.6, AC3.4.2, AC3.4.3, owner answer Q1 (A)
  - id: BR30.7
    statement: A parent always sees all of their own details; a super admin sees every family's full record.
    category: authorization
    applies_to: [DirectoryCard, ParentProfile]
    trigger: reading one's own entry, or a super admin reading the directory or the records screens
    logic: IF the shown parent is the viewer THEN every field and the sharing choice are returned. IF the viewer is a super admin THEN every field of every active parent and child is returned, with the sharing choice and the invitation state (BR37.4).
    violation: Not applicable.
    source: FR3.5, FR3.6, AC3.3.1
  - id: BR30.8
    statement: Removed parents, removed children and removed families are not in the directory.
    category: constraint
    applies_to: [DirectoryCard]
    trigger: any directory read
    logic: Only active families appear, and inside a family only active parents and children. A removed person appears elsewhere in history as "korábbi tag" through C6.
    violation: Not applicable.
    source: AC3.6.4, contract C6
  - id: BR30.9
    statement: Searching the directory matches only what the viewer can see.
    category: authorization
    applies_to: [DirectoryCard]
    trigger: typing in the directory search
    logic: The search runs over the cards the viewer was given, matching the family name, the parents' full names and any field shown on that card. A hidden field can never make a card match.
    violation: Not applicable.
    source: NFR1, ADR-008, mockups.md (Directory)

  # --- Sharing choice -----------------------------------------------------------------
  - id: BR31.1
    statement: The sharing box starts unticked for every parent.
    category: constraint
    applies_to: [ParentProfile]
    trigger: creating a parent, linking an account, or the structure change that installs this unit
    logic: A new profile has sharingConsent false. Every existing profile has false after this unit is installed.
    violation: Not applicable.
    source: FR3.2, AC3.2.1, assumption A1 in requirements.md
  - id: BR31.2
    statement: Only the parent themself can tick or untick their own sharing box.
    category: authorization
    applies_to: [ParentProfile]
    trigger: changing sharingConsent
    logic: IF the caller's current parent (C2 current_parent_id) is not the profile's parent THEN refuse. A super admin, teacher or another parent of the same family is refused too. The administrator's records screen offers no way to change it.
    violation: Denied refusal; nothing changes.
    source: FR3.2, NFR2, NFR3
  - id: BR31.3
    statement: A change of the sharing choice applies at the next read and is recorded with its time.
    category: policy
    applies_to: [ParentProfile]
    trigger: the parent saves a new value
    logic: IF the expected version is outdated THEN refuse with VERSION_CONFLICT. IF the value differs THEN store it, set consentChangedAt to now, and write the profile.sharing_changed audit action in the same transaction. IF it is the same value THEN succeed without a new audit row. Nothing caches a card, so another viewer's next load shows the change. A repeated key returns the stored result (C1).
    violation: Conflict refusal; nothing changes.
    source: NFR2, NFR4, NFR5, AC3.2.2, AC3.2.3
  - id: BR31.4
    statement: Unticking only hides; the parent's entries stay saved.
    category: policy
    applies_to: [ParentProfile]
    trigger: changing sharingConsent from true to false
    logic: Only sharingConsent and consentChangedAt change. Residence, occupation, hobby, how they support and phone stay stored, stay visible to the parent and super admins, and are shown again if the parent ticks the box later.
    violation: Not applicable.
    source: AC3.2.3, owner answer Q4 (A)
  - id: BR31.5
    statement: A parent without an active account cannot have shared, and never counts as shared.
    category: constraint
    applies_to: [ParentProfile, Account]
    trigger: any directory read; ending the account link; deactivating an account
    logic: Two safeguards. (1) Every directory read treats a parent as shared only when sharingConsent is true AND the parent is active AND linked to an account whose status is active; otherwise the parent counts as not shared for BR30.2 to BR30.5 and for the children rule BR30.4. (2) U3 extends Identity's existing account-status step so that deactivating an account sets the linked parent's sharingConsent to false in the same transaction, and ending the link (BR36.3) does the same. Reactivating an account therefore starts unshared; the parent ticks again if they wish.
    violation: Not applicable.
    source: AC3.1.8, NFR1, NFR3

  # --- Own details --------------------------------------------------------------------
  - id: BR32.1
    statement: A parent edits their own phone, place of residence, occupation, hobby and how they support the community, and nothing else of their record.
    category: authorization
    applies_to: [ParentProfile]
    trigger: saving "Adataim"
    logic: IF the caller's current parent is not the profile's parent THEN refuse. The full name, the family and the email are not changed by this command; the email changes only through BR34.
    violation: Denied refusal; nothing changes.
    source: FR3.6, AC3.3.1, NFR3
  - id: BR32.2
    statement: Each own-details field is checked, and an invalid field is named.
    category: validation
    applies_to: [ParentProfile]
    trigger: saving "Adataim"
    logic: Text is trimmed; empty means cleared. Phone, when given, holds 6 to 20 characters of digits, spaces, plus and hyphen. Residence and occupation are at most 100 characters, hobby at most 200, how they support at most 500. IF any field fails THEN refuse naming every failing field and store nothing.
    violation: Validation refusal naming the fields (PROFILE_FIELD_INVALID); the screen keeps everything the parent typed.
    source: AC3.3.2
  - id: BR32.3
    statement: Saving over a newer version of one's details is refused.
    category: constraint
    applies_to: [ParentProfile]
    trigger: saving "Adataim" with an outdated expected version
    logic: IF the expected version is not the stored version THEN refuse with VERSION_CONFLICT and store nothing. A repeated key returns the stored result.
    violation: Conflict refusal; the screen says the page is out of date and keeps what the parent typed.
    source: AC3.3.3, NFR5

  # --- Password change ----------------------------------------------------------------
  - id: BR33.1
    statement: A signed-in parent changes their password by giving the current one and a valid new one.
    category: validation
    applies_to: [Account]
    trigger: saving a new password under "Bejelentkezés"
    logic: This change runs through the sign-in service, not through a database command, so it is outside the C1 template (no idempotency key or expected version). The sign-in service checks the current password. IF it is wrong THEN refuse, counting it like a wrong password at sign-in, so the existing lockout applies. A repeated submit of the same form fails on its second arrival, because the old password is then no longer current. The new password follows the app's existing rule (at least 8 characters with a letter and a digit, at most 72 bytes) and must differ from the current one. IF it fails THEN refuse naming the reason.
    violation: Validation refusal (PASSWORD_CURRENT_WRONG or PASSWORD_INVALID); the password does not change.
    source: FR3.6, AC3.4.1
  - id: BR33.2
    statement: After a password change every other signed-in device is signed out.
    category: policy
    applies_to: [Account]
    trigger: a successful password change
    logic: Every session of the account except the one that made the change ends at once, so their next request is treated as signed out. The account.password_changed audit action is written.
    violation: Not applicable.
    source: owner answer Q7 (A), NFR3, NFR4

  # --- Email change -------------------------------------------------------------------
  - id: BR34.1
    statement: Asking for an email change needs the current password and a valid new address.
    category: validation
    applies_to: [EmailChangeRequest]
    trigger: submitting a new address under "Bejelentkezés"
    logic: The sign-in service checks the current password, with the same lockout as BR33.1. The new address is trimmed and lower-cased, must look like an email (at most 254 characters), and must differ from the current sign-in email.
    violation: Validation refusal (PASSWORD_CURRENT_WRONG or EMAIL_INVALID); no request is made.
    source: FR3.6, owner answer Q6 (A)
  - id: BR34.2
    statement: An address that belongs to anyone else is refused without saying whose.
    category: constraint
    applies_to: [EmailChangeRequest]
    trigger: asking for, and again at confirming, an email change
    logic: IF the new address is the sign-in email of another account, the emailOnRecord of another active parent, or the address of an open invitation THEN refuse. The refusal is the same in every case and names nobody.
    violation: Validation refusal (EMAIL_UNAVAILABLE) with one fixed message.
    source: AC3.4.4, NFR1
  - id: BR34.3
    statement: An account has at most one pending email change; a new request replaces the old one.
    category: constraint
    applies_to: [EmailChangeRequest]
    trigger: asking for a change, or "Új levél" (send again)
    logic: Any pending request of the account becomes replaced, and a new pending request with a new token is made, both in one transaction. The old link stops working. "Új levél" makes a new request for the same address. "Mégse" (cancel) sets the pending request to cancelled.
    violation: Not applicable.
    source: owner answer Q6 (A), mockups.md (My account)
  - id: BR34.4
    statement: The confirmation link works once, for 24 hours, and only for the address it was sent to.
    category: validation
    applies_to: [EmailChangeRequest]
    trigger: opening the confirmation link
    logic: The token is matched by its hash. IF no request matches, or it is not pending, or now is past expiresAt THEN the change does not happen and the page says the link is no longer valid, with a route back to "Fiókom". Opening the link needs no sign-in, because the link itself proves control of the new address.
    violation: Terminal refusal (EMAIL_LINK_INVALID); nothing changes.
    source: AC3.4.2, owner answer Q6 (A), mockups.md (My account)
  - id: BR34.5
    statement: Until the change is confirmed, the old email still signs in and the new one does not.
    category: policy
    applies_to: [Account, EmailChangeRequest]
    trigger: signing in while a change is pending
    logic: A pending request changes nothing about sign-in. The account's email and the directory (BR30.6) keep the old address until BR34.6.
    violation: Not applicable.
    source: AC3.4.3
  - id: BR34.6
    statement: Confirming changes the sign-in email, tells the old address, and is recorded.
    category: policy
    applies_to: [Account, EmailChangeRequest, ParentProfile]
    trigger: opening a valid confirmation link
    logic: The confirm step is not a signed-in command. The app's server calls it with the token on behalf of whoever opened the link; it is granted to the server's service role only, never to a signed-in or anonymous session. In one transaction it rechecks BR34.2, then lifts today's guard against sign-in email changes for this transaction only (the guard's existing transaction-local allowance), sets the sign-in service's own email record and the account's email to the new address together, sets emailOnRecord to it, and marks the request confirmed. Every other route that changes a sign-in email stays refused, as today, including the sign-in service's own self-service route. Write the account.email_changed audit action. Then send the old address an email saying the address was changed, naming no other person. Calling it again with the same token finds the request no longer pending and changes nothing (BR34.4).
    violation: IF BR34.2 now fails THEN the request is cancelled and the page shows the EMAIL_UNAVAILABLE message.
    source: FR3.6, AC3.4.2, owner answer Q6 (A), NFR4, NFR10

  # --- Adding families and parents ----------------------------------------------------
  - id: BR35.1
    statement: Only a super admin adds, edits or removes families, parents and children.
    category: authorization
    applies_to: [Family, Parent, Child, ParentProfile]
    trigger: any records-screen command
    logic: IF the caller is not a super admin THEN refuse, including a request that bypasses the screen. A parent, teacher or coordinator is refused whatever they send.
    violation: Denied refusal; nothing changes.
    source: FR3.7, AC3.6.3, NFR3
  - id: BR35.2
    statement: A new family needs a family name and at least one parent with a full name and an email, and then appears in the directory.
    category: validation
    applies_to: [Family, Parent, ParentProfile]
    trigger: adding a family
    logic: The family name is 1 to 200 characters. Each parent needs a full name of 1 to 200 characters and an emailOnRecord that looks like an email. Children are optional. IF anything fails THEN refuse naming the fields and store nothing. On success the family appears in the next directory read, with every parent unshared (BR31.1). The family.added and parent.added audit actions are written.
    violation: Validation refusal naming the fields; nothing is stored.
    source: FR3.7, AC3.6.1
  - id: BR35.3
    statement: A parent's email on record is unique among active parents and accounts.
    category: constraint
    applies_to: [ParentProfile]
    trigger: adding a parent or changing their emailOnRecord
    logic: IF another active parent has that emailOnRecord, or another account has it as sign-in email THEN refuse.
    violation: Validation refusal (EMAIL_UNAVAILABLE) naming the email field.
    source: FR3.7, AC3.4.4
  - id: BR35.4
    statement: The administrator edits names, phone, the email on record and children; the profile fields and the sharing choice are the parent's own.
    category: authorization
    applies_to: [Parent, ParentProfile, Child]
    trigger: editing a record on the records screen
    logic: A super admin may change the family name, a parent's full name and phone, a child's name, and emailOnRecord while the parent has no account. Once an account is linked, the email changes only through the parent's own BR34. Residence, occupation, hobby, how they support and sharingConsent are not editable by the administrator.
    violation: Denied refusal naming the field.
    source: FR3.5, FR3.7, BR31.2

  # --- Removing a parent's directory record -------------------------------------------
  - id: BR36.1
    statement: Removing a parent is a super admin's command that names the parent and its version.
    category: authorization
    applies_to: [Parent]
    trigger: confirming removal on the records screen
    logic: IF the caller is not a super admin THEN refuse. IF the expected version is outdated THEN refuse with VERSION_CONFLICT. A repeated key returns the stored result.
    violation: Denied or conflict refusal; nothing changes.
    source: FR3.7, AC3.6.3, AC3.6.4, NFR5
  - id: BR36.2
    statement: The only active parent of a family cannot be removed on its own.
    category: constraint
    applies_to: [Parent, Family]
    trigger: removing a parent
    logic: IF the parent is the family's only active parent THEN refuse; the reason says to remove the family instead.
    violation: Conflict refusal (PARENT_LAST_IN_FAMILY); nothing changes.
    source: owner answer Q5 (A)
  - id: BR36.3
    statement: A removed parent loses sign-in, sharing and contact details at once, and the removal is recorded.
    category: policy
    applies_to: [Parent, ParentProfile, Account, Invitation, EmailChangeRequest]
    trigger: a permitted removal
    logic: In one transaction, after locking the family row: set the parent to archived; end the sign-in through U1's removal step (C16), which deactivates the account, ends its sessions and clears the link; set sharingConsent to false; clear emailOnRecord, phone, residence, occupation, hobby and how they support; revoke the parent's open invitations; cancel any pending email change. Write the parent.removed audit action.
    violation: Not applicable.
    source: AC3.6.4, contract C16, NFR4
  - id: BR36.4
    statement: The directory's removal step counts and clears only the directory record.
    category: policy
    applies_to: [Parent, ParentProfile, Family]
    trigger: U14's removal preview and apply (C16)
    logic: The preview returns how many profiles would be cleared for a parent or for every parent of a family. Apply performs the clearing of BR36.3 for those parents. For subject kind parent it applies BR36.2 too, so a family's only active parent is refused on this path as well; that parent leaves only with subject kind family. For subject kind family it archives every active parent first, then the family, in one transaction after the family row is locked. Duties, books and tasks are not touched here; U14 flags them.
    violation: Not applicable.
    source: contract C16, AC3.6.2 (U14)

  # --- Invitations ----------------------------------------------------------------------
  - id: BR37.1
    statement: A super admin sends an invitation from a parent's page to a parent without an account.
    category: authorization
    applies_to: [Invitation]
    trigger: "Meghívó küldése" or "Új meghívó"
    logic: IF the caller is not a super admin THEN refuse. IF the parent already has an account THEN refuse. The invitation goes to emailOnRecord with a single-use link valid for 7 days. A new invitation replaces an open one for the same parent, whose link stops working. The invitation.sent audit action is written.
    violation: Denied or conflict refusal (PARENT_HAS_ACCOUNT); nothing is sent.
    source: FR3.8, AC3.7.1
  - id: BR37.2
    statement: A used, replaced, revoked or expired invitation link explains that it is no longer valid.
    category: validation
    applies_to: [Invitation]
    trigger: opening an invitation link
    logic: IF the invitation is not pending, or is older than 7 days THEN no account is created and the page shows "Ez a meghívó már nem érvényes. Kérj újat az adminisztrátortól."
    violation: Terminal refusal; nothing changes.
    source: AC3.7.2
  - id: BR37.3
    statement: Accepting an invitation links the account to the parent with sharing off.
    category: policy
    applies_to: [Invitation, Parent, ParentProfile, Account]
    trigger: accepting a valid invitation
    logic: The account's sign-in email is the invitation address. The parent is linked to the account, and sharingConsent stays false (BR31.1).
    violation: Not applicable.
    source: FR3.8, AC3.2.1
  - id: BR37.4
    statement: The administrator's parent page shows the invitation state.
    category: calculation
    applies_to: [Invitation]
    trigger: a super admin opens a parent's page
    logic: The state is one of no invitation, sent (with sending time and expiry), expired, or accepted. "Új meghívó" is offered for a parent without an account.
    violation: Not applicable.
    source: AC3.7.2, mockups.md (Invitation)
  - id: BR37.5
    statement: Invitation and email-change emails carry no other person's details.
    category: policy
    applies_to: [Invitation, EmailChangeRequest]
    trigger: sending any email of this unit
    logic: An email names only the community, the link and, for a change notice, the fact that the address was changed. No other family's or person's contact details appear.
    violation: Not applicable.
    source: NFR10

  # --- One-off load (C17) ---------------------------------------------------------------
  - id: BR38.1
    statement: The migration loads one family per call, safely repeatable, and returns no values.
    category: policy
    applies_to: [Family, Parent, ParentProfile, Child]
    trigger: the migration script loads a directory row (U15)
    logic: Callable by the service role only. The source key from the row identifies the family; a second call with the same key changes nothing and returns the stored result. The payload holds the family name, parents with full name, email, phone and place of residence, and children's names. Residence is loaded and stays hidden from other parents until the parent ticks sharing. Occupation, hobby, how they support and the sharing choice are not loaded, so every parent starts unshared. No invitation is sent. A bad payload returns a refusal naming the field, never a value.
    violation: Validation refusal; nothing is stored for that row.
    source: contract C17, FR18.1, FR18.4, FR18.5
```

## Rules Summary

| Group | Rules | What they settle |
|---|---|---|
| Directory reads | BR30.1 to BR30.9 | Who sees which field; children only when every parent shared; teachers always see phone and email; one email per parent; search sees only visible fields |
| Sharing choice | BR31.1 to BR31.5 | Unticked by default; only the parent changes it; recorded with time; unticking only hides |
| Own details | BR32.1 to BR32.3 | Five fields the parent edits; field-level errors; outdated page refused |
| Password | BR33.1 to BR33.2 | Current password needed; other devices signed out |
| Email change | BR34.1 to BR34.6 | Current password; one pending change; 24-hour single-use link; old address works until confirmed and is told afterwards |
| Adding records | BR35.1 to BR35.4 | Super admin only; required fields; unique email; what the administrator may edit |
| Removing a parent | BR36.1 to BR36.4 | Super admin only; not the only parent; sign-in, sharing and contacts cleared; U14's removal step |
| Invitations | BR37.1 to BR37.5 | Sent from the parent page; 7-day single-use link; state shown; no other person's details |
| One-off load | BR38.1 | The U3 part of the migration contract |

## Refusal Codes

| Code | State | Rules |
|---|---|---|
| VERSION_CONFLICT | conflict | BR31.3, BR32.3, BR36.1 |
| PROFILE_FIELD_INVALID | validation | BR32.2 |
| PASSWORD_CURRENT_WRONG | validation | BR33.1, BR34.1 |
| PASSWORD_INVALID | validation | BR33.1 |
| EMAIL_INVALID | validation | BR34.1, BR35.2 |
| EMAIL_UNAVAILABLE | validation | BR34.2, BR34.6, BR35.3 |
| EMAIL_LINK_INVALID | terminal | BR34.4 |
| PARENT_LAST_IN_FAMILY | conflict | BR36.2 |
| PARENT_HAS_ACCOUNT | conflict | BR37.1 |

Denied refusals (BR30.1, BR31.2, BR32.1, BR35.1, BR36.1, BR37.1) use the C1 denied state and name no code beyond it.
