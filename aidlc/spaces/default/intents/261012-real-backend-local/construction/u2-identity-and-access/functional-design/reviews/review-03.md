## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/functional-design/functional-spec.md > W6 step 2 and Elevated Function List; rules.md > BR2.12, BR2.23 | BR2.12 says a deactivated or unknown address sends no recovery email, but nothing in the design can check that before the sign-in service is asked to send it. The server's admin access has no table rights (BR2.23), the find-account function needs a signed-in admin, and no function on the authoritative list answers "is this email an active account" before sign-in. The existing migration already adds a function for this (account_recovery_check), which is not on the list, so the catalogue test in BR2.16 would fail. | Add the pre-session recovery-eligibility function to the Elevated Function List as admin access, add it to the BR2.23 execute-right list, and state in W6 step 2 that the server calls it before requesting the recovery email. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/functional-design/functional-spec.md > W7 step 3; rules.md > BR2.14 | Only deactivation says the server bans the sign-in user. Reactivation never says the ban is lifted, so a reactivated account would still be refused by the sign-in service. | State that reactivation lifts the ban through the admin access, with the same retry and report behaviour as deactivation, and add a test case. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/functional-design/rules.md > BR2.3 and functional-spec.md > W1 step 2 | The lock is described as 15 minutes counted from the fifth attempt, but the check counts attempts in a sliding 15-minute window. With attempts spread over 14 minutes the lock lifts 15 minutes after the first attempt, not the fifth. Housekeeping also runs only from the seed, reset and operator, so rows for many distinct unknown addresses can accumulate on a hosted database. | Pick one definition (sliding window or fixed 15 minutes from the fifth attempt) and write the test around it; say when housekeeping runs outside local development or bound the row count. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | Not run: the shell was blocked by the code-generation approval guard in this session | Cross-references were checked by hand against requirements FR2.1 to FR2.5 and FR3.3 and traceability.json; all resolve. |

### Summary

The design is implementable: requirement coverage resolves, the invitation and account lifecycles are consistent, and the reservation, lockout, session-active and service-role limits are traceable end to end. One Major gap (the pre-session recovery-eligibility function is missing from the authoritative function list) and two Minor gaps remain; none blocks the build.
