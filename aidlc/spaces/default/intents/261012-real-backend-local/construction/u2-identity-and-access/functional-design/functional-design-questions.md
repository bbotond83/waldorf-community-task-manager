# Functional Design Questions: U2 Identity and access

U2 adds real sign-in, sessions, invitations, password reset, role grants and the access rules (row-level security) with the screens they need. The requirements left some numbers and choices open for this unit. Answers here become rules in the design.

## Q1. How long does a sign-in session last?

A. 12 hours since the last activity, and at most 7 days in total, then the person signs in again.
B. 8 hours in total, no extension (strictest).
C. 30 days since the last activity (most convenient, weakest).
D. Not yet defined.
X. Other (please specify)

[Answer]: C. 30 days since the last activity (most convenient, weakest).

## Q2. How long is an invitation link valid?

A. 7 days; an admin can resend an expired invitation (which issues a new link and ends the old one).
B. 72 hours.
C. 30 days.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. 7 days; an admin can resend an expired invitation (which issues a new link and ends the old one).

## Q3. How quickly must a change of someone's role or scope (grant) take effect?

A. On the very next request: every request compares the session's authorization version with the stored one, so a change applies immediately and the old session is refused until it refreshes.
B. Within 60 seconds (the version is cached briefly).
C. Within 5 minutes.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. On the very next request: every request compares the session's authorization version with the stored one, so a change applies immediately and the old session is refused until it refreshes.

## Q4. What are the password rules?

A. At least 10 characters, up to 128, no required character mix; the common-password check of the sign-in service stays on.
B. At least 8 characters with at least one letter and one digit.
C. At least 14 characters.
D. Not yet defined.
X. Other (please specify)

[Answer]: B. At least 8 characters with at least one letter and one digit.

## Q5. How are repeated wrong passwords handled?

A. Use the sign-in service's built-in rate limits (per address and per account) and show a Hungarian "try again later" message; no extra lockout of our own.
B. Add our own lockout: after 5 wrong passwords in 15 minutes the account waits 15 minutes.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: B. Add our own lockout: after 5 wrong passwords in 15 minutes the account waits 15 minutes.

## Q6. How long is a password reset link valid, and what does the screen reveal?

A. 1 hour; the screen always says "if the address is known, an email was sent" so it does not reveal who has an account.
B. 24 hours with the same neutral message.
C. 1 hour, and say clearly when the address is unknown (easier, but reveals who has an account).
D. Not yet defined.
X. Other (please specify)

[Answer]: A. 1 hour; the screen always says "if the address is known, an email was sent" so it does not reveal who has an account.

## Q7. Where do role grants live?

A. Reuse and extend the existing grants table from the current-roles migration (one row per account, role and scope, with the authorization version), so the work already done and tested is kept.
B. A new grants table designed from scratch, replacing the old one.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Reuse and extend the existing grants table from the current-roles migration (one row per account, role and scope, with the authorization version), so the work already done and tested is kept.

## Q8. How does the operator give the first super admin's password to the one-time command?

A. The command asks for it on the keyboard without echoing it (never as a command-line argument or a file), and asks the operator to type the target host to confirm.
B. Through an environment variable, which is easier to script but can end up in shell history or logs.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. The command asks for it on the keyboard without echoing it (never as a command-line argument or a file), and asks the operator to type the target host to confirm.

## Consolidated Summary Confirmation

- Session: 30 days since the last activity.
- Invitation link: valid 7 days; an expired one can be resent (new link, old one ended).
- Grant changes: take effect on the very next request.
- Passwords: at least 8 characters with at least one letter and one digit.
- Wrong passwords: our own lockout, 5 wrong in 15 minutes locks the account for 15 minutes.
- Password reset: link valid 1 hour; the screen never reveals whether an address has an account.
- Grants: extend the existing grants table from the current-roles migration.
- First super admin command: the password is typed on the keyboard without echo (never an argument or a file), and the operator types the target host to confirm.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
