## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T16:07:53Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/nfr-requirements/tech-stack-decisions.md > NFR2.4 and security-requirements.md > NFR1.24 | The sign-in service limit is set to 30 sign-in or token requests per 5 minutes per source address. The functional spec (W1, W2) has the Next server make every sign-in and token refresh call. All of those calls therefore reach the sign-in service from one address, so the limit applies to the whole community at once, not to one attacker. Two effects follow. First, one script can lock every person out of sign-in. Second, the planned test load (browser flows, NFR3.4's three parallel runs with 4 workers, lockout tests with 5 failed attempts per case, the NFR1.22 comparisons) will exceed 30 per 5 minutes against the real stack and fail for the wrong reason. NFR1.24 describes the exposure only as an attacker guessing passwords for one account (360 per hour). It does not say who the source address is, nor how the test runs avoid the limit. | State which source address the sign-in service sees for the server's calls, for example whether the server forwards the client address. Say whether the limit is relaxed in the test profile or the tests use a separate stack setting. Add the shared-address denial of sign-in to the accepted-risk entry in NFR1.24. Make NFR2.9 check the test-profile value. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/nfr-requirements/tech-stack-decisions.md > NFR2.4 | The owner's confirmed answer Q4 was 10 emails per hour per address. NFR2.4 replaces it with "emails per hour for the whole project at the service's setting" and a 60-second gap. It gives no numeric value, so NFR2.9's read-back has nothing to compare, and the project-wide cap could block invitation and reset tests (NFR6.8, NFR1.22). | Give a concrete project-wide hourly email value for the local and test profiles. Record the deviation from Q4 in the checkpoint report. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/nfr-requirements/security-requirements.md > NFR1.22 | A reset for an unknown or deactivated address sends no email (BR2.12), while a known address sends one. The response-time difference between the two is only "reported" with a 100 ms target, so a timing oracle on account existence can still pass. | Either make the reset request send its email asynchronously and make the 100 ms bound a failing threshold, or record the timing difference as an accepted risk. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/nfr-requirements/reliability-requirements.md > NFR6.7 and observability-requirements.md > NFR1.17 | Housekeeping runs only from the seed, reset or an operator call (BR2.21), and an expired invitation stays stored as Pending. "Written by housekeeping for invitations that reach their expiry" does not say how a repeated run avoids writing the same expired event again, and "90 days after they end" does not define the end date for an expired but never replaced invitation. | Define the end date as expires_at for expired invitations. Define a once-only marker for the expired event, so housekeeping stays safe to repeat. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u2-identity-and-access/nfr-requirements/security-requirements.md > NFR1.7 | The check needs "a production-mode run behind a local https origin", but no technology decision provides an https proxy or certificate for it. | Name the local https mechanism in tech-stack-decisions.md, or limit the secure-flag check to the unit test of the cookie-options function. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual cross-reference of traceability.json | PASS | NFR1.1 to NFR1.24, NFR2.1 to NFR2.9, NFR3.1 to 3.4, NFR4.1 to 4.5, NFR5.1 to 5.3, NFR6.1 to 6.8, NFR7.1 to 7.2 and NFR8.1 all exist in the artifacts. |
| Manual check against rules.md and functional-spec.md | PASS with notes | Lockout (BR2.3), the recovery flow (BR2.12), session rules (BR2.5, BR2.6), service-role limits (BR2.23), invitation retries (BR2.11) and housekeeping (BR2.21) each map to a requirement and a check. The only deviation from the functional design is the 90-day retention, which NFR6.7 states openly. |

### Summary

The NFRs line up with the functional design and each has a measurable check. One Major gap remains: the rate-limit design does not account for every call reaching the sign-in service from the app server's single address, either for real use or for the test load. With one Major and four Minor findings the artifacts are implementable, so the verdict is READY. The Major finding should be settled before code generation.
