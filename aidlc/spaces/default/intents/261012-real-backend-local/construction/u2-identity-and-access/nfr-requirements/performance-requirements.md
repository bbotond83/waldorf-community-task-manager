# Performance Requirements: U2 Identity and access

Targets on the owner's machine with the local stack running. Source: confirmed answers Q1 and Q5 in `nfr-requirements-questions.md`, NFR4 of the requirements, and the functional rules BR2.5 to BR2.7.

| ID | Requirement | Target | Check |
|---|---|---|---|
| NFR4.1 | Sign-in on the real stack, from submit to the home screen | Within the existing 5000 ms login budget (pass or fail); typically within 2 seconds, reported | The existing login-time performance test is extended to the real sign-in |
| NFR4.2 | The active-session and access checks (`current_session_is_active`, the policy helpers and the authorization version read) added to one ordinary request | At most 50 ms on the local database, reported; the test fails above 200 ms | A database test measures a policy-filtered read with and without the checks over 50 runs and compares the median |
| NFR4.3 | Invitation lookup, reserve and acceptance | Each function completes within 500 ms locally, reported | Timing lines in the invitation database test |
| NFR4.4 | The scope probe | At most 50 ms added to a detail screen, reported | Timing in the probe test |
| NFR4.5 | Housekeeping on the 300-account data set | Within 5 seconds, reported | Timing line in the housekeeping test |

Reported targets are shown in the run output and in the unit checkpoint report; only NFR4.1 (5000 ms) and the 200 ms ceiling of NFR4.2 fail a run.
