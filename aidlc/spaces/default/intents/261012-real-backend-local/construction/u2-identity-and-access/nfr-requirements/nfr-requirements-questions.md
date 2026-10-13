# NFR Requirements Questions: U2 Identity and access

U2 adds sign-in, sessions, invitations, password reset, grants and the access rules. These questions fix the quantitative targets for it. Already settled and carried over: sign-in within the existing 5000 ms budget, the screens meet WCAG 2.2 AA, coverage stays at or above 80%, sessions last 30 days since the last activity, links last 7 days (invitation) and 1 hour (reset).

## Q1. How much time may the session and access checks add to an ordinary request?

A. Sign-in typically within 2 seconds locally (the 5000 ms budget stays the pass or fail limit), and the active-session and access checks together add at most 50 ms to a request on the local database (reported, with a test that fails above 200 ms).
B. Only keep the existing 5000 ms sign-in budget; no per-request target.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Sign-in typically within 2 seconds locally (the 5000 ms budget stays the pass or fail limit), and the active-session and access checks together add at most 50 ms to a request on the local database (reported, with a test that fails above 200 ms).

## Q2. What should the server record about sign-in activity?

A. Structured log lines with an event code for sign-in success, failure, lockout, invitation created, accepted and expired, reset requested and used, grant changes and deactivation, each with a keyed hash of the account (never the email, password, token or link) and a timestamp; kept as normal server output, no dashboards.
B. Nothing beyond the audit log (which covers grant changes and the first super admin only).
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Structured log lines with an event code for sign-in success, failure, lockout, invitation created, accepted and expired, reset requested and used, grant changes and deactivation, each with a keyed hash of the account (never the email, password, token or link) and a timestamp; kept as normal server output, no dashboards.

## Q3. How long are accepted, replaced, revoked and expired invitations kept?

A. 90 days after they end, then removed by the housekeeping function.
B. 1 year.
C. Until the next reset (local only), with no removal.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. 90 days after they end, then removed by the housekeeping function.

## Q4. How should the sign-in service's own rate limits be set?

A. Sign-in and token requests: at most 30 per 5 minutes per address; emails (invitation and reset) at most 10 per hour per address; reported in the code summary.
B. Stricter: 10 per 5 minutes per address and 4 emails per hour.
C. Leave the stack defaults.
D. Not yet defined.
X. Other (please specify)

[Answer]: A. Sign-in and token requests: at most 30 per 5 minutes per address; emails (invitation and reset) at most 10 per hour per address; reported in the code summary.

## Q5. What size must this unit handle without special tuning?

A. Up to 300 accounts and 50 signed-in sessions at the same time (a school community), with the indexes the access checks need; no load test beyond a small local timing check.
B. Up to 3000 accounts and 500 sessions, with a local load test.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Up to 300 accounts and 50 signed-in sessions at the same time (a school community), with the indexes the access checks need; no load test beyond a small local timing check.

## Consolidated Summary Confirmation

- Speed: sign-in typically under 2 seconds locally (5000 ms stays the limit); session and access checks add at most 50 ms, with a test failing above 200 ms.
- Activity record: structured event lines with keyed account hashes, never email, password, token or link.
- Retention: ended invitations removed 90 days after they end.
- Rate limits: 30 sign-in or token requests per 5 minutes per address, 10 emails per hour per address.
- Size: up to 300 accounts and 50 sessions without tuning, with the needed indexes and a small local timing check.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
