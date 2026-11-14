# Security Design: u3-directory-and-profile

How the targets in `security-requirements.md` are met, following `functional-spec.md`, `rules.md`, `tech-stack-decisions.md` and contracts C1, C2, C6, C16 and C17 in `contract-summary.md`. Contains no names or contact details.

## Authorization Architecture

**Directory reads.** One read function, `directory_list`, checks the session with U1's `can_read_community` and returns a denied refusal otherwise, never an empty list (NFR3.1). It works out the viewer once (parent, teacher or super admin, and which family) and then builds each field with a plain case on that viewer and on whether the shown parent counts as shared. A hidden field is never selected into the result, so no later layer can leak it. The "shared" test is one internal helper used by every rule (BR30.2 to BR30.5): sharing ticked, parent active, linked account active (NFR3.2).

**Commands.** Every records command (add, edit, remove, invite) calls U1's super-admin decision point first, after the session check and before any lookup, so a parent, teacher or group administrator gets the same denied result whatever they send (NFR3.3). Sharing and own-details commands compare the caller's `current_parent_id` with the profile's parent and refuse every other caller, including a super admin (NFR3.4).

**Password and email change.** The app server asks the sign-in service to check the current password. A wrong one is recorded through the existing attempt step, so the same five-in-15-minutes lock applies (NFR3.5). Only after that check does the server call the database command for the email request. That command, `email_change_request`, is granted to the service role only (like the confirm step) and takes the account id from the server's checked session, so a signed-in session cannot call it directly and skip the password check; a test calls it as a signed-in account and sees it refused. Because the caller is the server, the command itself checks that the account it is given is active and linked to a current parent, and refuses otherwise. The password-change audit row (and the sessions-ended step) is written by the app server through the service role, using the existing audit function. The same holds for `email_change_cancel` and the "Új levél" resend, which run through the server with the session's account. The lockout test (NFR3.5) is joined by this direct-call refusal.

**Email confirmation.** `email_change_confirm(token_hash)` is granted to the service role only. The app server calls it when the link is opened, on behalf of whoever opened it. Inside one transaction it uses today's transaction-local allowance in the sign-in-email guard, so every other route that changes a sign-in email stays refused. A test calls the self-service route and a direct update and sees both refused (NFR3.6).

**Rights.** Signed-in accounts keep select only. Every new function starts with `revoke all`, pins its search path, then gets an explicit `grant execute`; internal helpers go to nobody. The contacts table's direct read rule is narrowed to super admins and the parent themself, so the old family-wide read route is closed (NFR3.7).

## Data Protection Design

| Requirement | Design |
|---|---|
| NFR1.1 | The seed and fixtures hold invented families only; secret scanning is unchanged. |
| NFR1.2 | The search runs in the browser over the cards received and sends no query, so a hidden value cannot make a card match (BR30.9). A test types a hidden value and gets no match. |
| NFR1.3 | The directory reads the email from the account when one is linked, else from the record; the pending address lives only on the request row, which no directory function reads. |
| NFR1.4 | Both email-taken checks (asking, confirming) go through one helper that returns one refusal code and one fixed message, whichever table matched. |
| NFR1.5 | Retention is set by the request's finish time: for confirmed, replaced and cancelled it is `decidedAt`; for an expired request it is `expiresAt`, so no job has to mark it. The existing housekeeping step deletes rows whose finish time is more than 30 days old. Removing a parent deletes their pending request row outright, so the address is gone at once (this refines BR36.3 and NFR7.1, which say cancel; for this Unit they are read as "deleted", and the code and tests follow this design, and `rules.md` BR36.3 and BR34.3 and NFR7.1's pass criterion are to be read that way (the design is the later decision; the functional rules are not edited here); the audit row for the removal keeps the fact, with no address). |

## Consent Design

The sharing command reads the stored value under the family and parent lock order, compares the expected version, stores the value and `consentChangedAt`, and writes the audit row in the same transaction (NFR2.2). No directory result is cached anywhere, so the next load of any viewer reads the new value (NFR2.1). Starting states are set by the structure change (every profile false), by the invitation-accept step and the account-link step (false), and by the account-status step on deactivation (false).

## Audit Design

Each command that changes data writes its audit row through the existing audit function in the same transaction as the change (NFR4.1); own-details saves and administrator record edits keep today's audit behaviour and add no new action. A repeated key returns the stored result before the audit write, and an unchanged sharing value skips the write, so no second event appears (NFR4.3). Rows carry opaque ids and counts only: the audit row for an email change names the account id, not the address (NFR4.2).

The password change runs through the sign-in service, so its audit row is written by the app server immediately after the service confirms the change, through the existing audit function. If the row cannot be written the change is not undone, and the failure is reported as an event line; this is the one place where the audit row is not in the same transaction, and a test covers the failure line (NFR4.1, as refined in `reliability-design.md`).

## Email Design

Emails are built by one function per kind from a fixed Hungarian template holding only the community name, the link and, for the change notice, the fact of the change (NFR10.1). Links are 32 random bytes; only the SHA-256 hash is stored (NFR10.2).

**Resend limit (NFR10.3).** A small table `email_send_attempts` holds `(kind, email_hash, sent_at)`, where `email_hash` is the existing keyed hash of the address, never the address. Before sending, the command counts rows for that kind and hash in the last hour and refuses with `EMAIL_RATE_LIMITED` when there are 3. A row is written only when a send is accepted, so refused tries do not extend the window, and a replayed command (same idempotency key) sends nothing and writes no row; the table has row-level security on and no read for application roles; the rate check runs after the address-availability check only for the signed-in parent's own address, so it cannot reveal that mail was recently sent to someone else's address; a send that fails at the mail server still counts, because the address was reached. Rows older than 24 hours are deleted by the housekeeping step. The count and insert run under the per-hash advisory lock described in `scalability-design.md` (same key, taken first), so two requests at once cannot both take the last slot.

## Evidence Design

NFR3.1 and NFR3.2 are proven by one database test per row of the "Who sees what" matrix, as real roles, plus the ticked-then-deactivated case. NFR3.3 and NFR3.4 are proven by direct calls of each command as a parent, teacher and group administrator. NFR3.8 is proven by the authorization-matrix test with rows for the directory, own account, records and invitations, and a browser specification that opens each new screen as each role.

## Input Validation

Text is trimmed; limits are on the table columns as well as in the function (BR32.2, BR35.2). Emails are lower-cased and checked for shape and length in the database. Ids go through the existing safe parser and are checked against the caller's community. React escapes all displayed text.
