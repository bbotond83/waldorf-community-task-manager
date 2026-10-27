# Requirements Analysis Questions: B3 denied-call audit rate limit

Your decision (2026-10-27): each account may have at most about 20 denied audit events per hour. Further denials are still returned as denied but are not written. The scan found that every audit record goes through a single function, `platform_audit_write`, so the limit can be enforced there once. These questions settle the details that "about 20 per hour" leaves open.

## Q1. [Product owner] What does "per hour" mean?

Context: a sliding window counts the last 60 minutes at the moment of each denial. A clock hour resets at the top of each hour, so up to about 40 events can be written within a few minutes around the hour boundary.

A. A sliding 60-minute window: before writing a denied event, count that account's denied events in the last 60 minutes (Recommended)
B. The current clock hour (for example 14:00 to 14:59 server time)
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Where exactly is the cut-off?

Context: "about 20" needs a fixed number for the code and the tests.

A. Write the first 20 denied events in the window; the 21st and later are not written (Recommended)
B. A different number (please specify)
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Does the limit also apply to the built-in system account?

Context: calls made by admin and service connections (no signed-in user) are recorded under one fixed system account. Their denials come from our own server code, not from a user, so a burst usually signals a bug worth seeing in full.

A. Exempt the system account: its denied events are always written (Recommended)
B. Apply the same limit to the system account
X. Other (please specify)

[Answer]: A

## Q4. [Developer] Must the limit hold exactly when one account is denied in several calls at the same moment?

Context: without extra locking, simultaneous denials for one account can each see 19 earlier events and all be written, so the limit can be exceeded by a few events. The project already uses a per-account lock for the same kind of problem (duplicate-request detection).

A. Yes: take a short per-account lock before counting, so no more than the limit is ever written (Recommended)
B. No: accept a small overshoot under simultaneous calls ("about 20" allows it)
X. Other (please specify)

[Answer]: A
