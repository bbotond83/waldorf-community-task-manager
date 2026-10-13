# Rules: U2 Identity and access

Source: requirements FR2.1 to FR2.5, FR3.3, NFR1, NFR5, ADR-004, ADR-006, ADR-007, ADR-009, ADR-011, ADR-012, U1's rules (BR3.2 audit actions, BR3.3 atomic audit, BR3.6 idempotency, BR3.9 audit function access), the existing migrations (the roles are `parent`, `kindergarten_teacher`, `group_admin`, `super_admin`; the helper functions are `has_current_role_scope`, `has_super_scope`, `has_core_scope` and `authorization_version_for`), and the confirmed answers Q1 to Q8.

```yaml
rules:
  - id: BR2.1
    statement: "A person signs in with email and password and every failure shows the same Hungarian message"
    category: validation
    applies_to: Identity
    trigger: "a sign-in attempt on the app's sign-in screen"
    logic: "IF the sign-in service accepts the email and password AND the account is active AND the account is not locked THEN the sign-in service's session is used (BR2.5); OTHERWISE the screen shows one generic Hungarian message (wrong data, unknown address and deactivated all look alike); a locked account is told to try again later, and that message is shown for unknown addresses too"
    violation: "no session is kept; the response never reveals whether the address has an account"
    source: FR2.1
  - id: BR2.2
    statement: "A deactivated account cannot sign in and every session of it stops working at once"
    category: authorization
    applies_to: "Identity, Access"
    trigger: "an account is deactivated, or a deactivated account tries to sign in or use a session"
    logic: "IF a super admin deactivates an account THEN the function sets the account status to deactivated, increases its authorization version and writes account.deactivate in one transaction, and afterwards the server bans the sign-in user through the sign-in service's admin access and calls the function that deletes that user's session and refresh-token rows (the admin API has no per-user session removal); because the database helpers require an active account (BR2.6), every request of that account is refused immediately even if the follow-up call to the sign-in service fails (the failure is retried and reported); grants stay stored but are ignored; a super admin can reactivate the account (BR2.14)"
    violation: "the request is refused with the generic message"
    source: FR2.1
  - id: BR2.3
    statement: "Five wrong passwords in 15 minutes lock the account's sign-in screen for 15 minutes"
    category: policy
    applies_to: Identity
    trigger: "a wrong-password attempt on the sign-in screen"
    logic: "IF a wrong password is submitted THEN one SignInAttempt row is recorded for the keyed email hash; IF 5 rows exist in the last 15 minutes THEN sign-in is refused for 15 minutes counted from the fifth attempt, with the try-again-later message, whether or not the address has an account; the attempt counts for every wrong password, including for unknown or deactivated addresses (so the screen behaves the same for all); attempts made while locked are not recorded, so the lock never extends itself; a successful sign-in clears the rows; the lockout is advisory and covers the app's screen only: direct calls to the sign-in service are limited by the service's own rate limits, configured in the stack (see the risk note); the sign-in service's password-verification hook, which could enforce the lockout for direct calls too, was considered and left out because it adds a database function inside the sign-in service's own configuration (a later hardening step)"
    violation: "the attempt is refused with the try-again-later message and no password check is made"
    source: "FR2.1 (answer Q5)"
  - id: BR2.4
    statement: "A new password has 8 to 72 characters with at least one letter and one digit"
    category: validation
    applies_to: Identity
    trigger: "a password is set at invitation acceptance, at password reset or by the operator command"
    logic: "IF the password is shorter than 8 characters, longer than 72 bytes (the limit of the sign-in service's hashing), has no letter, or has no digit THEN it is refused with a Hungarian message naming the rule; the same text is checked on screen and on the server; the sign-in service's own checks also apply"
    violation: "validation result; nothing is changed"
    source: "FR2.3, FR2.4 (answer Q4)"
  - id: BR2.5
    statement: "The session is the sign-in service's session and lasts 30 days since the last activity"
    category: policy
    applies_to: Identity
    trigger: "a request carries the session cookie"
    logic: "IF the request's token belongs to a session that still exists in the sign-in service's session table and was refreshed within 30 days THEN the session is active; the stack is configured with a 30-day inactivity timeout and short-lived access tokens (about 1 hour) that the server refreshes; OTHERWISE the request is treated as signed out; the cookie holds the sign-in service's tokens, is httpOnly and sameSite lax, secure whenever the site is served over https, and is never readable by browser scripts"
    violation: "the person is sent to the sign-in screen"
    source: "FR2.2 (answer Q1)"
  - id: BR2.6
    statement: "The database accepts only requests of an active session of an active account"
    category: authorization
    applies_to: "Access, ApplicationKernel"
    trigger: "any policy check or elevated function call"
    logic: "IF a request reaches the database THEN the function current_session_is_active() must be true: the token's session id exists in the sign-in service's session table (not signed out, not past the inactivity limit) AND the account's status is active; every policy helper (has_current_role_scope, has_super_scope, has_core_scope, authorization_version_for) and every elevated function calls it first; a token obtained any other way (for example by calling the sign-in service directly) therefore still cannot read or write more than the sign-in service itself allows for that live session, and a signed-out, expired or deactivated session reads nothing"
    violation: "the helper returns false and the request sees no rows or a denied result"
    source: "FR2.2, FR2.5, FR3.3"
  - id: BR2.7
    statement: "Every request checks the session and the current authorization version"
    category: authorization
    applies_to: ApplicationKernel
    trigger: "any request that needs a signed-in person"
    logic: "IF the session is not active (BR2.5, BR2.6) THEN refuse; the grants are read from the database on every request through the policy helpers, so a change of grants applies on the very next request; the kernel also compares the authorization version it last saw for the account with the stored one and refreshes what it caches for display; the kernel's other checks are the scope probe and the idempotency record"
    violation: "unauthenticated request is redirected to sign-in; a request without the needed grant gets a denied result"
    source: "FR2.2, FR2.5 (answer Q3)"
  - id: BR2.8
    statement: "Sign-out ends only that session and many people may be signed in at once"
    category: constraint
    applies_to: Identity
    trigger: "sign-out, or several sessions at once"
    logic: "IF the person signs out THEN that session is ended in the sign-in service (scope local) and the cookie is cleared; other sessions of the same or other accounts are unaffected; there is no limit on concurrent sessions per account"
    violation: "none"
    source: FR2.2
  - id: BR2.9
    statement: "Only an admin within scope can invite, and only for roles within their own reach"
    category: authorization
    applies_to: Identity
    trigger: "an invitation is created, resent or revoked"
    logic: "IF the actor is a super_admin of the organization THEN any role and scope in it is allowed; IF the actor is a group_admin THEN only parent or kindergarten_teacher invitations for a family or group in the actor's own group, and they can revoke or resend only invitations they or other admins of their group created for their group; OTHERWISE refused. An invitation needs email, role, scope and, for parent, a family"
    violation: "denied result; no invitation is created or changed"
    source: FR2.3
  - id: BR2.10
    statement: "An invitation link is a single-use token valid for 7 days, and an expired or pending one can be resent"
    category: policy
    applies_to: Identity
    trigger: "an invitation is created, resent or opened"
    logic: "IF an invitation is created THEN a 32-byte random token is generated, only its hash is stored, and expires_at is 7 days later; the application sends the invitation email itself through the stack's mail server (the local mail catcher locally) with the link /meghivas/<token>, because the sign-in service's own invitation email cannot carry the app's token; IF an admin resends a pending or expired invitation THEN a new invitation row replaces it (status replaced) with a new token and a new 7-day expiry; IF the link is opened after expires_at, or after status replaced, revoked or accepted THEN the screen says it is no longer valid and how to ask for a new one; at most one pending unexpired invitation exists for the same email, role and scope; the lookup of a token before sign-in is a narrow function that returns only the role, scope and validity"
    violation: "the link is refused with a Hungarian message; creating a duplicate returns a conflict result"
    source: "FR2.3 (answer Q2)"
  - id: BR2.11
    statement: "Accepting an invitation creates the account and the grant atomically and survives a failed clean-up"
    category: constraint
    applies_to: "Identity, Access, ApplicationKernel"
    trigger: "the invited person submits a password on a valid invitation"
    logic: "IF the invitation is pending and unexpired and the password passes BR2.4 THEN, first, a reserve function locks the invitation row and moves it from pending to accepting with reserved_at set (a second submit while a reservation is held, or a reservation older than 2 minutes being released first, returns a retry or not-valid result, so only one submit proceeds); only the holder of the reservation then creates the sign-in user (tagged with the invitation id) or, when a user tagged with this invitation id already exists and has no Account (left by an earlier failed attempt), sets its password and reuses it; then one database function in one transaction (a) creates the Account with the same id and the invitation's organization, (b) creates the RoleGrant and the AuthorizationVersion row, (c) marks the invitation accepted and records the accepted account, (d) writes the audit event role.grant with the system actor, the invitation as target and details invitation:<id> so the inviter is traceable, and (e) leaves a marked hook where U3 links the Parent; IF the function fails THEN the reservation is released to pending, and the server deletes the sign-in user only when no Account exists for it (it never deletes or resets a user that has an Account, so a concurrent winner is never harmed); a user that cannot be deleted is reused on the next attempt and removed by the housekeeping function when older than 1 hour without an Account; the same idempotency key on a repeated submit returns the stored success; a new submit on an accepted invitation returns the not-valid message; if the email already has an Account (the reserve function checks this itself and answers with a distinct code), acceptance is refused with the not-valid message and an admin, who can look the account up with the find-account function under their own session (BR2.16), grants the role to the existing account instead"
    violation: "nothing is saved except a possible leftover user that never blocks a retry; the person sees a retry message"
    source: FR2.3
  - id: BR2.12
    statement: "Password reset works through an emailed single-use link valid for 1 hour and never reveals who has an account"
    category: policy
    applies_to: Identity
    trigger: "a reset is requested or a reset link is used"
    logic: "IF a reset is requested THEN the screen always shows the same message (if the address is known, an email was sent), and for a known active account the sign-in service's recovery email is sent through the stack's mail server (the local mail catcher locally); its template links to /jelszo-visszaallitas/uj?token_hash=<hash>&type=recovery and the one-time-code lifetime is configured to 1 hour; opening the link only shows the page, and the exchange of the hash for a session happens when the person submits the form (a POST), so a mail scanner that opens the link cannot use up the single-use code; the person sets a new password (BR2.4), every other session of the account is ended by the session-removal function, and the sign-in attempts are cleared; requests for a deactivated or unknown address send nothing"
    violation: "an expired or used link shows the not-valid message with a way to request a new one"
    source: "FR2.4 (answer Q6)"
  - id: BR2.13
    statement: "There are four roles, each with a fixed kind of scope, and sign-up is closed"
    category: constraint
    applies_to: "Access, Identity"
    trigger: "a grant is stored or someone tries to create a sign-in user"
    logic: "IF a grant is stored THEN role and scope_type match the existing constraint: parent with family, kindergarten_teacher and group_admin with group, super_admin with organization (scope equals the organization); one account may hold several grants; IF anyone but the server's admin access tries to create a sign-in user THEN it fails because open sign-up is switched off in the stack's configuration, so invitation (or the operator command and the seed) is the only way an account is created"
    violation: "the database refuses the row; a direct sign-up call is refused by the sign-in service"
    source: "FR2.5, FR2.3 (answer Q7)"
  - id: BR2.14
    statement: "Grants, deactivation and reactivation change only through audited functions with a limited reach"
    category: authorization
    applies_to: Access
    trigger: "a grant is added or revoked, or an account is deactivated or reactivated"
    logic: "IF a super_admin of the organization changes any grant, or deactivates or reactivates an account of the organization, or a group_admin adds or revokes parent and kindergarten_teacher grants for their own group (group admins cannot deactivate or reactivate accounts and cannot touch grants outside their group), THEN the function applies the change, increases the account's authorization version and writes role.grant, role.revoke, account.deactivate or account.reactivate (U2 adds the last two to U1's audit action list) in one transaction with the idempotency record; a denied attempt commits only its denied event; the check that the last active super_admin grant of an organization is not removed, and that its account is not deactivated, runs under a row lock on that organization's super_admin grants so two concurrent changes cannot both pass"
    violation: "denied or conflict result; nothing changes"
    source: FR2.5
  - id: BR2.15
    statement: "Row-level security expresses the four-role matrix and has a policy test for every role and read path"
    category: authorization
    applies_to: Access
    trigger: "a table is created or a read path is added"
    logic: "IF a table holds family-, group- or organization-owned data THEN row-level security is on and its policies use the existing helpers (has_current_role_scope for a parent's own family, has_core_scope for group admins and super admins) after the active-session check (BR2.6), so a parent reads only their own family, a group admin only their group, a super admin their organization; a kindergarten_teacher has no raw table access and reads only the schedule projection that U3 provides (its tests are added in U3); the policy test list has one case per role (parent, kindergarten_teacher, group admin of the same group, group admin of another group, super admin, an account with no grant, a deactivated account, a signed-out session) for every table that exists, run in the default schema and a worker schema; the Identity tables follow the access table in entities.md; the two existing self-read policies on grants and versions are replaced by versions that check the active session; U1's open item is settled here: a super admin reads the audit events of their organization and a group admin the events whose group is their own, through a read policy on the audit table (no writes), with its policy tests"
    violation: "the database test fails and blocks the unit"
    source: FR3.3
  - id: BR2.16
    statement: "Elevated database functions come from one authoritative list and each checks the caller itself"
    category: authorization
    applies_to: "Access, ApplicationKernel"
    trigger: "an elevated function is created"
    logic: "IF a function runs with elevated rights (security definer) THEN it appears in the single list in functional-spec.md, pins its search path (U1 BR1.5), is executable only by the roles named for it, and checks the caller (active session and grants, or the server's admin access for the functions that run before or outside a session) before doing anything; a catalogue test lists every security-definer function in the schema and fails for one that is not on the list; the list is complete for U2 and U1, and later units append theirs; the server's admin access (the sign-in service's service-role key) lives only in one server-only module used for creating, banning and ending sessions of sign-in users and for calling the pre-session functions; it is never imported by client code, a bundle test proves it, and U1's configuration check is changed so the key is read only by that module, not by the general runtime configuration"
    violation: "a catalogue test fails for a function not on the list or not pinned"
    source: "FR3.3, NFR1 (design review R-12)"
  - id: BR2.17
    statement: "A detail screen asks the scope probe first so denied differs from not found, without leaking records of other organizations"
    category: authorization
    applies_to: "Access, ApplicationKernel"
    trigger: "a detail screen is opened"
    logic: "IF a detail screen needs a record THEN the scope probe (elevated, minimal columns) returns allowed, denied or not_found for the signed-in account and the record's type and id; allowed lets the normal policy-filtered read run; denied (the record exists in the caller's own organization but outside their scope) shows the Hungarian access-denied state; a record that is missing, or belongs to another organization, always answers not_found, so the probe is no oracle across organizations (record ids are random uuids, so the answer inside one organization reveals nothing guessable); the record types the probe supports are family, parent, task, event, assignment, change request, notification and import run, and each later unit registers its own; the probe returns nothing else"
    violation: "a wrong-role test proves the probe leaks no column, and that another organization's record answers not_found"
    source: "FR3.3 (ADR-009)"
  - id: BR2.18
    statement: "The first super admin of an organization is created by a one-time operator command"
    category: constraint
    applies_to: DevelopmentTooling
    trigger: "an operator runs the first-super-admin command"
    logic: "IF no active super_admin grant exists for the given organization THEN, after the operator types the target host to confirm (it must match the database address) and types the password without echo (never an argument, a file or an environment variable; the password must pass BR2.4), the command, under an advisory lock for that organization, creates the sign-in user through the admin access, the Account, the organization-scope grant and the version row, and writes the audit event role.first_super_admin with the system actor; IF any step fails THEN the new sign-in user is removed and nothing else is left; IF an active super_admin exists for that organization THEN it refuses; the organization record itself is created by the unit that owns organizations (U3), so U3 extends this command to create it"
    violation: "the command stops with a message and changes nothing"
    source: "FR2.3 (ADR-012; answer Q8)"
  - id: BR2.19
    statement: "Real sign-in lives beside the old picker until U5 removes it"
    category: constraint
    applies_to: WebApp
    trigger: "U2 ships its screens"
    logic: "IF the new real screens are added THEN they use their own routes (/bejelentkezes, /jelszo-visszaallitas, /jelszo-visszaallitas/uj and the existing /meghivas/<token>) and the old profile picker, hard-coded profiles and parent-local login remain reachable until U5 removes them; screens still on synthetic data do not honour the new session until their unit moves them"
    violation: "none: a construction-time state"
    source: "FR2.6 (supports)"
  - id: BR2.20
    statement: "The sign-in, invitation and reset screens are Hungarian, keyboard operable and meet WCAG 2.2 AA"
    category: constraint
    applies_to: WebApp
    trigger: "a screen is built"
    logic: "IF a screen is built THEN all copy is Hungarian, every control is labelled, errors are announced to assistive technology and linked to their field, contrast is at least 4.5:1 for text and 3:1 for controls, and the browser flow passes the automated accessibility check with no serious or critical violation"
    violation: "the accessibility check fails and blocks the unit"
    source: "NFR5"
  - id: BR2.21
    statement: "Housekeeping removes expired rows and orphaned users"
    category: policy
    applies_to: Identity
    trigger: "the housekeeping function runs (seed and reset run it; the operator can call it on a hosted database)"
    logic: "IF the function runs THEN it removes SignInAttempt rows older than 15 minutes, keeps at most 20 rows per email hash, and removes sign-in users tagged with an invitation id that have no Account and are older than 1 hour"
    violation: "none: leftovers never block a person"
    source: "FR2.3 (supports BR2.3, BR2.11)"
  - id: BR2.22
    statement: "The superseded first-migration audit table is dropped only after a check proves nothing uses it"
    category: constraint
    applies_to: Access
    trigger: "U2's migration runs"
    logic: "IF the catalogue shows no function body, policy, view or foreign key that mentions app_audit_events outside the first migration that creates it, and no source file mentions it outside that migration and its checksum test, THEN U2's migration drops it (together with its own policy); OTHERWISE the migration leaves it and the test names what still uses it; the existing tests that pin the first migration are updated in step with the drop"
    violation: "the test fails and blocks the unit"
    source: "FR3.5 (supports; U1 owns the audit log)"
  - id: BR2.23
    statement: "The sign-in service's service-role key reaches the database only through named functions, and U1's key rule is changed on purpose"
    category: authorization
    applies_to: "Access, ApplicationKernel, DevelopmentTooling"
    trigger: "U2 adds the server-only admin module"
    logic: "IF the server uses the sign-in service's service-role key THEN it is read only by one server-only admin module (not by the general runtime configuration), which supersedes U1 BR1.4 for exactly that module and for no other code; the key bypasses row-level security, so U2 revokes every table right of service_role on every table in the schema (the U2 tables, the grants and version tables, and the older domain tables for families, assignments and import runs), revokes its execute right on U1's lifecycle hold functions, idempotency cleanup and any function not named for it, and grants it execute only on the functions the elevated list marks as admin access (lockout check, attempt record and clear, invitation lookup, reserve, acceptance, session removal, housekeeping; the find-account function is NOT among them because it needs a signed-in admin as actor); U1's database tests that call the hold functions or cleanup as service_role are changed to call them as a signed-in super admin or through the test helper's owner connection; U1's secret scan keeps its rule that key values never appear in tracked files (only the documented local default is allowed by hash); U1's runtime configuration check is changed so the key is not accepted in the general runtime settings but only read by the admin module; a database test lists service_role's privileges and fails for any not on this list; a bundle test proves the module is never part of client code"
    violation: "the privilege test or the bundle test fails and blocks the unit"
    source: "NFR1, design review"
```

## Summary

| Group | Rules |
|---|---|
| Sign-in, sessions, deactivation | BR2.1 to BR2.8 |
| Invitations | BR2.9, BR2.10, BR2.11 |
| Password reset | BR2.12 |
| Roles, grants, sign-up closed | BR2.13, BR2.14 |
| Row-level security, elevated list, scope probe | BR2.15, BR2.16, BR2.17 |
| Operator command | BR2.18 |
| Screens and coexistence | BR2.19, BR2.20 |
| Housekeeping and clean-up | BR2.21, BR2.22 |
| Service-role key limits | BR2.23 |

Risks recorded from the owner's choices: a session of 30 days since the last activity is the longest of the offered options; an 8-character password with a letter and a digit is short; the lockout covers only the app's sign-in screen, so someone calling the sign-in service directly is limited only by its rate limits (configured in the stack), and lockout of a victim's address by an attacker is possible for 15 minutes. These are mitigated by the sign-in service's common-password check and rate limits, by BR2.6 (a token only works while its session and account are active), by ending other sessions on reset (BR2.12), and by the audit log; the first super admin's password is typed, never read from the environment (answer Q8).
