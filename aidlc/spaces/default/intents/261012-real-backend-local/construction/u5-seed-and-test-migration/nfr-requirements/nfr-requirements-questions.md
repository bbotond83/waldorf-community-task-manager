# NFR Requirements Questions: U5 Seed and test migration

U1 to U4 are built and approved. U5 adds the seed and reset commands, moves the remaining tests off the synthetic demo data and removes it, and writes the documents. These questions set the targets that are still open. Smaller points are listed as assumptions at the end.

## Q1. [Tester] How should the browser tests be kept apart once they run on real data?

The browser suite runs in three browsers (Chromium, Firefox, a phone-sized Chrome). Today they share demo data copies; on real data each browser needs its own database schema, so one browser's sign-ups do not change what another browser sees (requirement FR10.2).

A. Each browser gets its own schema and its own server; the schema is reset to the small seed before every test file; the browsers run one after another. Slower (an estimated 30 to 40 minutes for the full suite) but the most predictable.
B. Same isolation, but the three browsers run at the same time. About one third of the time, with a higher chance of timing-related failures on a laptop.
C. Reset before every single test. The strongest isolation and by far the slowest.
X. Other (please specify)

[Answer]: A. Each browser gets its own schema and its own server; the schema is reset to the small seed before every test file; the browsers run one after another.

## Q2. [Owner] How fast must the seed and reset commands be on your machine?

The requirements already say: small seed within 60 seconds and reset within 30 seconds. The 30-family set for demonstrations has no target yet.

A. Keep the two targets and add one for the 30-family seed: within 120 seconds. A command that goes over its limit is reported as failed by the timing test.
B. Same numbers, but reported only; a slow run never fails the build.
C. Not yet defined for the 30-family set.
X. Other (please specify)

[Answer]: A. Keep the two targets and add one for the 30-family seed: within 120 seconds. A command that goes over its limit is reported as failed by the timing test.

## Q3. [Owner] Which of the open items from the earlier units should U5 fix?

Two behaviours were left open earlier. (1) Audit events should be deleted after 365 days, but no code does this yet; it would be a small database function called by the housekeeping step. (2) When a family moves to another group, the reminders already planned for group-wide tasks are not re-planned for the new group. Fixing (2) is new product behaviour, which U5 otherwise excludes.

A. Fix (1) only; list (2) as a known limit in the final report. (Recommended)
B. Fix both.
C. Fix neither; list both as open items in the final report.
X. Other (please specify)

[Answer]: A. Fix (1) only; list (2) as a known limit in the final report.

## Assumptions (no answer needed; tell me if one is wrong)

1. Security: the seed and reset refuse to run unless the database address is a loopback address and the database reports itself as the local stack; the seed's test passwords are fictitious, live in one tracked seed file and are never printed in logs; no real personal data is read or written; the real workbook is never opened by the seed or by any test.
2. Seed content: all data is fictitious; records get fixed uuids so tests can name them; seeding twice gives the same result; a failed seed leaves nothing half-written (one transaction per schema).
3. Test migration: every test that exercises data runs on the local database in its own worker schema; pure logic tests stay as they are; the four synthetic adapters, `src/teacher-tracking`, the synthetic fixtures, the reset endpoint, the profile picker and the `scenario` hooks are deleted, and each deletion is proven by a test, as in U3 and U4.
4. Coverage stays at or above 80% lines, branches and functions on all production source, measured after the deletions.
5. Documents: the English README and the Hungarian testing guide (`HASZNALATI_UTMUTATO_HU.md`) are rewritten for real sign-in, invitations, password reset, the seed commands and testing with several people at once; a short report states that the real workbook is still in git history until you rewrite it.
6. Dependencies: the first task of this unit updates `zod` and the packages behind `undici` so `npm audit` with high and critical blocking passes again.
7. The import screen's header "Adminisztráció · szintetikus folyamat" becomes "Adminisztráció · Import", since no synthetic mode remains.
8. Reliability and observability follow U2 to U4: expected failures are result codes, unexpected ones are logged once with an event code and no personal data.

## Consolidated Summary Confirmation

- Browser tests: each of the three browsers has its own schema and server, reset to the small seed before every test file, running one after another.
- Timing: small seed within 60 s, reset within 30 s, 30-family seed within 120 s; a timing test fails the build above a limit.
- Open items: the 365-day audit purge is built in this unit; reminder re-planning on a group change stays a known limit.
- The eight assumptions at the top of the file stand (local-only guard, fictitious fixed-id seed, deletions proven by tests, 80% coverage, documents, dependency fix first, import header "Adminisztráció · Import", result-code error handling).

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
