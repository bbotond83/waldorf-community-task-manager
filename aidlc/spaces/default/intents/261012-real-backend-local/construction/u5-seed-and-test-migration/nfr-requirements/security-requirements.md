# Security and Quality Requirements: U5 Seed and test migration

Source: NFR1 to NFR8 of the requirements, FR9 to FR12, the answers in `nfr-requirements-questions.md`, and U1 to U4's requirements. U5 adds no product behaviour; its requirements cover the seed and reset, the test migration, the removal of synthetic mode and the documents. This unit's artifact set has one file for requirements and one for technology decisions, so every category sits in a section below. Numbering continues after U4 (NFR1.62, NFR2.27, NFR3.17, NFR4.16, NFR5.7, NFR6.26, NFR7.4, NFR8.3).

## Security and privacy (NFR1)

| ID | Requirement | Check |
|---|---|---|
| NFR1.63 | The seed and reset refuse to run unless the database address is a loopback address (`127.0.0.1`, `localhost`, `[::1]`) and the database identifies itself as the local stack; they print a plain refusal and change nothing otherwise (FR9.3, FR2.7) | Tests with a hosted-looking address, a non-loopback address and a missing setting: each is refused and leaves a fixture database untouched |
| NFR1.64 | The seed's test passwords are fictitious, live in one tracked seed file, are used only for accounts the seed creates, and are never printed in logs, command output, the README or error messages; the production path stays invitation-only (FR2.7, NFR1) | A scan of the command output and logs for the passwords; a test that the production runtime cannot reach the seed code |
| NFR1.65 | The seed, reset, tests and fixtures never read or write real personal data: no code path reads `source-materials/`, all names, emails and phone numbers are fictitious and use example domains (FR7.2, FR11.1) | U4's path-guard test extended to the seed code; the privacy scan with the updated allowlist |
| NFR1.66 | Seed and reset use only the service-role connection of the local stack, from the server-side scripts; the key never reaches the browser or a tracked file (FR1.4) | The bundle scan (U2) and the secret scan |
| NFR1.67 | Removing synthetic mode removes every route, cookie and switch that could create a session or reset data without real sign-in: the profile picker, the hard-coded profiles, the `parent-local` login, `/api/synthetic/*`, the reset endpoint, the per-browser copies and the `scenario` hooks (FR2.6, FR10.1) | A deletion test that fails if any of these names or routes exists in production source, plus a request test that each old route answers not found |
| NFR1.68 | The 365-day audit retention is enforced by one elevated database function with a pinned search path, callable only by the system caller, that deletes audit events older than 365 days and writes no personal data; it is called by housekeeping and the seed and reset commands (the answer to Q3) | A role matrix test (only the system caller), a clock-controlled test (an event just under and just over 365 days), an entry in the elevated-function catalogue |
| NFR1.69 | The final report states that the real workbook is still in git history until the owner rewrites it, and the privacy scan keeps failing for any tracked workbook or data file (FR11.1, FR11.2) | The report file exists with that statement; the existing privacy scan test |
| NFR1.70 | The dependency audit passes with high and critical findings blocking; the first task of this unit updates `zod` and the packages behind `undici` and corrects the audit row in earlier summaries | `npm audit --audit-level=high` in the verification chain |

## Verification and determinism (NFR2, NFR3)

| ID | Requirement | Check |
|---|---|---|
| NFR3.18 | Seeding twice gives the same result: records have fixed uuids, a second seed changes nothing, and a reset followed by a seed equals a fresh seed (FR9.1, FR9.2, NFR3) | A test comparing a full dump of the schema after seed, seed again, and reset plus seed |
| NFR3.19 | A failed seed leaves no half-written data: each schema is seeded in one transaction (NFR6) | A failure-injection test that breaks the seed midway and finds the schema as it was |
| NFR3.20 | Every browser has its own schema and its own server, reset to the small seed before every test file; the three browsers run one after another, with no browser sharing a schema with another or with a database test (FR10.2; answer to Q1) | A configuration test over the browser setup and three full runs in a row without interference |
| NFR3.21 | Every data-exercising unit, component, database and browser test runs on the local database in its own worker schema; logic-only tests stay as they are; nothing relies on run order (FR10.1, NFR3) | The shuffled-order run (U3 NFR3.16) over all database test files and a list check that no test imports synthetic code |
| NFR2.28 | Line, branch and function coverage stay at or above 80% on all production source, measured after the synthetic modules and the four synthetic adapters are deleted and including the seed and reset code (NFR2) | `npm run test:coverage` in the verification chain |
| NFR2.29 | Each deleted synthetic module is deleted only when each of its rules has a proof against the database or a recorded reason for dropping it, as in U3 and U4 (BR34.1, BR43.1) | The replaced-modules test lists the deleted folders and fails if one returns |

## Performance (NFR4)

| ID | Requirement | Check |
|---|---|---|
| NFR4.17 | The small seed completes within 60 seconds and a reset within 30 seconds on the owner's machine (NFR4); a run above a limit fails the timing test | Timing tests with a fixed, reported duration per command |
| NFR4.18 | The 30-family seed completes within 120 seconds (answer to Q2); a run above the limit fails the timing test | The same timing test for the large set |
| NFR4.19 | A sign-in still completes within the existing 5000 ms budget on the seeded data (NFR4) | The existing login-time test, run on seeded data |
| NFR4.20 | The full browser suite's duration is reported (estimated 30 to 40 minutes serial) and does not fail a run by itself, so the CI job timeout is raised only if the first full run needs it | The verification report |

## Accessibility and screens (NFR5, NFR7)

| ID | Requirement | Check |
|---|---|---|
| NFR5.8 | No screen is added; the one wording change (the import screen header becomes "Adminisztráció · Import") keeps the screen's accessibility result, and the automated scan stays in the critical browser flow with no serious or critical violation (NFR5) | The browser accessibility scan on the import screen and the identity screens |
| NFR7.5 | Screens keep their markup, Hungarian copy, test ids and behaviour except where synthetic mode appears on screen (the import header, the removed picker); the browser tests are moved to real sign-in without changing what they assert about the page (NFR7) | The migrated browser specs assert the same copy and test ids |

## Reliability and observability (NFR6)

| ID | Requirement | Check |
|---|---|---|
| NFR6.27 | Migrations stay repeatable on a fresh database and on every worker schema after U5's new migration (the audit purge) (NFR6) | The migration repeatability test (U4 NFR6.17) |
| NFR6.28 | A reset leaves a clean state in every schema it touches, including the staged import rows and the reminder and notification tables, and calls the expiry and reminder-tick system functions so no stale staged data or due job survives (U4 NFR2.22) | A reset test that finds every table empty except the reference data, and a test that the expiry and tick functions ran |
| NFR6.29 | The seed and reset report their outcome as a result line (success or a named refusal or failure) with no personal data and no passwords; unexpected failures are logged once with an event code, as in U2 to U4 (NFR8) | Output and log tests with fictitious personal values |
| NFR6.30 | The known limits are written down: reminder recipients are not re-planned when a family changes group (the answer to Q3 leaves it open), staged-data expiry depends on sign-ins until a scheduler exists in a hosted environment, and hosted-target checks remain outstanding evidence (M7) | The final report lists each limit |

## Language and naming (NFR8)

| ID | Requirement | Check |
|---|---|---|
| NFR8.4 | The seed's visible text (names of groups, events, tasks) is Hungarian fictitious data; identifiers, file names, commands and technical documents are English; the Hungarian testing guide and the README follow the requirement FR12.1 and FR1.5 | Copy checks for the seed data and a review of the two documents |
