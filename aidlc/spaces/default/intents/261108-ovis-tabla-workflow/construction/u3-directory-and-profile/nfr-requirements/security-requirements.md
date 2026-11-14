# Security Requirements: u3-directory-and-profile

Sources: `functional-spec.md` and `rules.md` of this Unit, NFR1 to NFR4 and NFR10 in `requirements.md`, contracts C1, C2, C6, C16 and C17 in `contract-summary.md`, `technology-stack.md`, and the answers in `nfr-requirements-questions.md` (Q1, Q2). Contains no names or contact details.

## Authentication

Sign-in, sessions and the password rule do not change, except that a password change ends every other session of the account (BR33.2). A signed-out visitor receives no directory data and is sent to sign-in. Links (email change, invitation) are 32 random bytes, stored only as a SHA-256 hash, as today.

## Authorization Requirements

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR3.1 | Every directory read decides on the database side which fields the viewer gets (BR30.1 to BR30.7, ADR-008). A hidden field is absent from the result. | One database test per row of the "Who sees what" matrix, run as the real roles and accounts. |
| NFR3.2 | A parent counts as shared only with sharing ticked, an active parent record and an active linked account (BR31.5), including after the account is deactivated. | A test ticks, deactivates the account, and reads the directory as another parent. |
| NFR3.3 | Records commands (add, edit, remove, invite) are super admin only, including by calling the function directly (BR35.1, BR36.1, BR37.1). | The fixed-list "out of reach" test passes for each command, for a parent, teacher and group administrator. |
| NFR3.4 | Only the parent can change their own sharing choice and own details (BR31.2, BR32.1); a super admin, teacher or the other parent of the family is refused. | "Out of reach" tests for each of those callers. |
| NFR3.5 | The password and email-change steps check the current password first; a wrong one counts towards the existing sign-in lockout (BR33.1, BR34.1). | A test makes five wrong current-password attempts and sees the lock. |
| NFR3.6 | The email-confirmation step is granted to the service role only, never to a signed-in or anonymous session, and every other route that changes a sign-in email stays refused (BR34.6). | The catalogue test lists its grants; a test tries the sign-in service's own self-service route and a direct update. |
| NFR3.7 | Signed-in accounts keep read-only table rights. Every new function starts with `revoke all` and an explicit `grant execute`, pins its search path, and grants no table write right. The contact table's direct read rule allows only super admins and the parent themself. | The catalogue test lists each new function's grants; a table-read test as a parent and a teacher. |
| NFR3.8 | `verification/authorization-matrix.json` gains rows for the directory, own account, records and invitations for every role, and every new screen is walked through for every role. | Evidence is in the Unit's test results before merge. |

## Data Protection

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR1.1 | The seed, fixtures and tests use invented families and people only. | Secret scanning and the privacy check stay green. |
| NFR1.2 | The directory search matches only fields the viewer can see (BR30.9). | A test searches for a hidden value and gets no match. |
| NFR1.3 | A pending, unconfirmed email address is never shown to anyone but the parent who asked (BR30.6). | A directory read as another parent during a pending change. |
| NFR1.4 | A refusal for a taken email address is one fixed message that names nobody (BR34.2, BR35.3). | A test compares the refusal for an address held by an account, by a parent and by an invitation. |
| NFR1.5 | A finished email-change request (confirmed, replaced, cancelled or expired) is deleted 30 days after it finishes, by the existing housekeeping step (answer Q2). Removing a parent cancels a pending one at once and clears the address (BR36.3). | A housekeeping test ages a finished request past 30 days and finds it gone; a younger one stays. |

## Consent

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR2.1 | A change of the sharing choice shows at the next directory load of any viewer; nothing caches a card (BR31.3). | A test changes the choice and reads as another parent immediately. |
| NFR2.2 | Every sharing change stores its time, and a parent starts unshared after creation, account linking, reactivation and the install of this Unit (BR31.1, BR31.5). | Tests for each of the four starts. |

## Audit

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR4.1 | The new audit actions are `profile.sharing_changed`, `account.password_changed`, `account.email_change_requested`, `account.email_changed`, `family.added`, `parent.added`, `parent.removed` and `invitation.sent`, each written in the transaction of its change (see observability-requirements.md). | A test reads the event after each command. |
| NFR4.2 | An audit event carries opaque ids, never a name, email, phone or profile text. | A test reads every new event's fields. |
| NFR4.3 | A repeated click writes no second event, and an unchanged sharing value writes none (BR31.3). | The "repeated click" tests count events. |

## Email

| ID | Requirement | Pass criterion |
|---|---|---|
| NFR10.1 | An email of this Unit names only the community, the link and, for a change notice, the fact that the address changed (BR37.5). | A test reads every email sent by the mail catcher. |
| NFR10.2 | Email-change links last 24 hours and invitation links 7 days, work once, and a newer link replaces the older (BR34.3, BR34.4, BR37.1). | Tests for used, replaced, cancelled and expired links. |
| NFR10.3 | At most 3 confirmation or invitation emails go to the same address per hour for each kind; the 4th is refused with a Hungarian "try again in an hour" message and no email is sent (answer Q1). Refused attempts do not extend the window. | A test sends 3, sees the 4th refused, and sees the next accepted once the hour has passed. |

## Threat Considerations

| Threat | Control |
|---|---|
| A parent calls the directory function or reads a table directly to see hidden fields | Fields are decided in the database; table reads are limited (NFR3.1, NFR3.7) |
| A removed or deactivated parent still shows as sharing | Shared means active account and active record (NFR3.2) |
| An email-change link is guessed or reused | 32 random bytes, hash only, single use, 24 hours (NFR10.2) |
| Someone tests which addresses are registered | One fixed refusal (NFR1.4) |
| Someone floods an inbox with resend requests | 3 per address per hour per kind (NFR10.3) |
| An email-change confirmation changes a sign-in email without the link | The step is service-role only and checks the token (NFR3.6) |
| A function with raised rights is steered to another schema | Every function pins its own schema (NFR3.7) |
