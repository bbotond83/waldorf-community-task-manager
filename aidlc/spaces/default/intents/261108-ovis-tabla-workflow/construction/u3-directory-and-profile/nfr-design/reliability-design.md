# Reliability Design: u3-directory-and-profile

How the targets in `reliability-requirements.md` are met, following `functional-spec.md`, `rules.md` and `contract-summary.md`. Nothing is hosted, so no availability target or failover applies.

## Transaction Design

| Requirement | Design |
|---|---|
| NFR7.1 | `parent_remove` is one function: lock the family row, then the account row (when the parent has an account), then the parent row (order in `scalability-design.md`), archive the parent, call U1's removal step (C16), set sharing false, clear the contact and profile fields, revoke open invitations, delete a pending email request (NFR7.1 and BR36.3 say cancel; the row is deleted so the new address is cleared at once), write the audit row. Any failure rolls the whole call back. |
| NFR7.2 | `email_change_confirm` recheck, sign-in email, account email, email on record and request state change in one transaction; the sign-in service's own email record is in the same database. |
| NFR7.3 | `family_add` stores the family, parents, profiles and children in one function, or none. |
| NFR7.4 | The migration creates the profile table, copies names, families and links, sets every sharing value to false, redefines the live functions, then drops the old free-text columns. A test applies it over a seeded database and compares row counts. |
| NFR7.5 | A failed send keeps the stored request or invitation and returns a retryable result with a resend offer, as invitations do today. The rate-limit row is still counted (see `security-design.md`). |
| NFR7.6 | Every change runs `npm run verify:local` on all three browsers. |

## Failure Handling

**Password change audit.** The change happens in the sign-in service and cannot be in one database transaction with its audit row. The server writes the audit row right after the service confirms, and a failed write is reported as an event line without undoing the change (the password is already changed and the parent must not be locked out). This is a recorded deviation from NFR4.1 (the one place the audit row is not in the change's transaction). It is unavoidable because the sign-in service owns the password, and it differs from NFR7.2 because the email record lives in this database while the password hash does not. A crash between the change and the audit write loses the row; the change is still visible through the sign-in service's own record. A test forces the failure and reads the line.

**Other sessions.** After a password change the server ends every other session of the account through the sign-in service. If that step fails, the change stands and the failure is reported as an event line; the parent sees "A másik eszközök kijelentkeztetése nem sikerült, próbáld újra a jelszóváltoztatást." (NFR7.5 pattern). A test covers success and the failure line.

**Email send.** Sending happens after the database commit. A failed send leaves a pending request or an open invitation that the parent or administrator can resend.

Recovery is forward-only: a defect found after merge is fixed by a new migration file.

## Testing Design

Every database rule gets the fixed list; the read rules and the password change record why "outdated screen", "repeated click" and "two people at once" have no meaning (NFR6.2). Each new database test file is added to its `test:database:*` script and to the shuffled run (NFR6.3). Tests that touch the old profile fields change in the same pull request, so none mentions them (NFR6.4). Application code keeps the 80% line, branch and function coverage (NFR6.1).

## Existing Behaviour

| Requirement | Design |
|---|---|
| NFR11.1 | The lifecycle anonymisation step is redefined to clear the profile as BR36.3 does; its test gains cases for the new fields. |
| NFR11.2 | `directory_removal_preview` and `directory_removal_apply` follow C16: counts for a parent or family, the only-parent refusal on the parent path, no touching of duties, books or tasks. |
| NFR11.3 | The account-status step sets sharing false in the same transaction on deactivation and on ending the account link. |
